const {getFirestore, FieldValue} = require("firebase-admin/firestore");
const logger = require("firebase-functions/logger");

const CONTACT_MESSAGES_COLLECTION = "contactMessages";
const DEDUPE_COLLECTION = "contactMessageEmailEvents";

function toDisplayValue(value) {
  if (value === null || value === undefined) return "N/A";
  const normalized = String(value).trim();
  return normalized ? normalized : "N/A";
}

function formatCreatedAt(value) {
  if (!value) return "N/A";
  if (typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "N/A";
  return parsed.toISOString();
}

function buildContactMessageBody({messageId, data}) {
  return [
    "A new Tasleya contact message was created.",
    "",
    `document id: ${toDisplayValue(messageId)}`,
    `createdAt: ${formatCreatedAt(data.createdAt)}`,
    `message: ${toDisplayValue(data.message)}`,
    `page: ${toDisplayValue(data.page)}`,
    `language: ${toDisplayValue(data.language)}`,
    `userAgent: ${toDisplayValue(data.userAgent)}`,
  ].join("\n");
}

async function markEventIfFirst({db, eventId, messageId}) {
  const dedupeRef = db.collection(DEDUPE_COLLECTION).doc(eventId);
  let shouldSend = false;

  await db.runTransaction(async (tx) => {
    const existing = await tx.get(dedupeRef);
    if (existing.exists) return;

    tx.set(dedupeRef, {
      messageId,
      status: "pending",
      createdAt: FieldValue.serverTimestamp(),
    });

    shouldSend = true;
  });

  return {shouldSend, dedupeRef};
}

async function sendWithResend({apiKey, from, to, subject, body, idempotencyKey}) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      text: body,
    }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const reason = payload && payload.message ? payload.message : response.statusText;
    throw new Error(`Resend error (${response.status}): ${reason}`);
  }

  return payload;
}

async function handleContactMessageCreated(event, config) {
  const snapshot = event.data;
  if (!snapshot) {
    logger.warn("contactMessages create event had no snapshot data", {
      eventId: event.id,
    });
    return;
  }

  const messageId = snapshot.id;
  const data = snapshot.data() || {};
  const db = getFirestore();

  const {shouldSend, dedupeRef} = await markEventIfFirst({
    db,
    eventId: event.id,
    messageId,
  });

  if (!shouldSend) {
    logger.info("Skipped duplicate contact message email event", {
      eventId: event.id,
      messageId,
    });
    return;
  }

  const subject = "New Tasleya contact message";
  const body = buildContactMessageBody({messageId, data});

  try {
    const providerResponse = await sendWithResend({
      apiKey: config.resendApiKey,
      from: config.fromEmail,
      to: config.recipientEmail,
      subject,
      body,
      idempotencyKey: event.id,
    });

    await Promise.all([
      dedupeRef.set(
          {
            status: "sent",
            providerMessageId: providerResponse.id || null,
            sentAt: FieldValue.serverTimestamp(),
          },
          {merge: true},
      ),
      snapshot.ref.set(
          {
            notification: {
              emailSentAt: FieldValue.serverTimestamp(),
              eventId: event.id,
            },
          },
          {merge: true},
      ),
    ]);

    logger.info("Contact message email sent", {
      eventId: event.id,
      messageId,
      recipientEmail: config.recipientEmail,
      providerMessageId: providerResponse.id || null,
    });
  } catch (error) {
    await dedupeRef.set(
        {
          status: "failed",
          failedAt: FieldValue.serverTimestamp(),
          error: error instanceof Error ? error.message : String(error),
        },
        {merge: true},
    );

    logger.error("Failed to send contact message email", {
      eventId: event.id,
      messageId,
      recipientEmail: config.recipientEmail,
      error: error instanceof Error ? error.message : String(error),
    });

    throw error;
  }
}

module.exports = {
  CONTACT_MESSAGES_COLLECTION,
  handleContactMessageCreated,
};

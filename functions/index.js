const {initializeApp} = require("firebase-admin/app");
const {onDocumentCreated} = require("firebase-functions/v2/firestore");
const {defineSecret, defineString} = require("firebase-functions/params");

const {
  CONTACT_MESSAGES_COLLECTION,
  handleContactMessageCreated,
} = require("./src/contactMessageNotification");

initializeApp();

const RESEND_API_KEY = defineSecret("RESEND_API_KEY");
const CONTACT_MESSAGE_NOTIFY_TO = defineString("CONTACT_MESSAGE_NOTIFY_TO", {
  default: "tasleyaonline@gmail.com",
});
const CONTACT_MESSAGE_NOTIFY_FROM = defineString("CONTACT_MESSAGE_NOTIFY_FROM");

exports.onContactMessageCreated = onDocumentCreated(
    {
      document: `${CONTACT_MESSAGES_COLLECTION}/{messageId}`,
      secrets: [RESEND_API_KEY],
    },
    async (event) => {
      await handleContactMessageCreated(event, {
        resendApiKey: RESEND_API_KEY.value(),
        recipientEmail: CONTACT_MESSAGE_NOTIFY_TO.value(),
        fromEmail: CONTACT_MESSAGE_NOTIFY_FROM.value(),
      });
    },
);

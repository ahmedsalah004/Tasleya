(function () {
  const CONTACT_MIN_LENGTH = 3;
  const CONTACT_MAX_LENGTH = 1000;
  const CONTACT_SUBMIT_COOLDOWN_MS = 5000;
  const CONTACT_FORM_ACTION = "https://formspree.io/f/mnjobyeq";

  const state = { submitting: false, cooldownUntil: 0 };
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function ensureTrigger() {
    let trigger = document.getElementById("tasleyaGlobalContactBtn");
    if (!trigger) {
      trigger = document.createElement("button");
      trigger.id = "tasleyaGlobalContactBtn";
      trigger.type = "button";
      trigger.className = "tasleya-contact-trigger";
      trigger.textContent = "تواصل معنا";
      document.body.appendChild(trigger);
    }
    return trigger;
  }

  function ensureModal() {
    let modal = document.getElementById("tasleyaGlobalContactModal");
    if (modal) return modal;

    modal = document.createElement("div");
    modal.id = "tasleyaGlobalContactModal";
    modal.className = "tasleya-contact-modal hidden";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "tasleyaGlobalContactTitle");
    modal.innerHTML = `
      <div class="tasleya-contact-modal__content">
        <h2 id="tasleyaGlobalContactTitle">تواصل معنا</h2>
        <p class="tasleya-contact-modal__subtitle">اكتب رسالتك هنا</p>
        <form id="tasleyaGlobalContactForm" action="${CONTACT_FORM_ACTION}" method="POST">
          <label class="tasleya-contact-modal__label" for="tasleyaGlobalContactMessage">رسالتك</label>
          <textarea id="tasleyaGlobalContactMessage" class="tasleya-contact-modal__textarea" name="message" minlength="3" maxlength="1000" required></textarea>
          <p class="tasleya-contact-modal__hint">للتواصل المباشر عبر البريد الإلكتروني: <a href="mailto:contact@tasleya.online">contact@tasleya.online</a></p>
          <p class="tasleya-contact-modal__hint">إذا رغبت في الحصول على رد، يمكنك كتابة اسمك وبريدك الإلكتروني.</p>
          <label class="tasleya-contact-modal__label" for="tasleyaGlobalContactName">الاسم (اختياري)</label>
          <input id="tasleyaGlobalContactName" class="tasleya-contact-modal__input" type="text" name="name" maxlength="80" autocomplete="name" />
          <label class="tasleya-contact-modal__label" for="tasleyaGlobalContactEmail">البريد الإلكتروني (اختياري)</label>
          <input id="tasleyaGlobalContactEmail" class="tasleya-contact-modal__input" type="email" name="email" maxlength="120" autocomplete="email" inputmode="email" dir="ltr" />
          <p class="tasleya-contact-modal__privacy">لن نستخدم بياناتك إلا إذا كنت ترغب في تلقي رد.</p>
          <p id="tasleyaGlobalContactFeedback" class="tasleya-contact-modal__feedback" role="status" aria-live="polite"></p>
          <div class="tasleya-contact-modal__actions">
            <button id="tasleyaGlobalContactSend" class="tasleya-contact-modal__send" type="submit">إرسال</button>
            <button id="tasleyaGlobalContactClose" class="tasleya-contact-modal__close" type="button">إغلاق</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);
    return modal;
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function setFeedback(message, type) {
    const feedback = document.getElementById("tasleyaGlobalContactFeedback");
    if (!feedback) return;
    feedback.textContent = message || "";
    feedback.classList.remove("is-error", "is-success", "is-info");
    if (message && type) feedback.classList.add(`is-${type}`);
  }

  function openModal() {
    const modal = ensureModal();
    const sendBtn = document.getElementById("tasleyaGlobalContactSend");
    state.submitting = false;
    if (sendBtn) sendBtn.disabled = false;
    setFeedback("", "");
    modal.classList.remove("hidden", "is-closing");
    void modal.offsetWidth;
    modal.classList.add("is-open");
    const messageInput = document.getElementById("tasleyaGlobalContactMessage");
    if (messageInput) requestAnimationFrame(() => messageInput.focus());
  }

  function closeModal() {
    const modal = document.getElementById("tasleyaGlobalContactModal");
    if (!modal || modal.classList.contains("hidden")) return;
    if (prefersReducedMotion) {
      modal.classList.add("hidden");
      modal.classList.remove("is-open", "is-closing");
      return;
    }
    modal.classList.remove("is-open");
    modal.classList.add("is-closing");
    const onEnd = function () {
      modal.classList.add("hidden");
      modal.classList.remove("is-closing");
      modal.removeEventListener("animationend", onEnd, true);
    };
    modal.addEventListener("animationend", onEnd, true);
  }

  async function submitMessage(event) {
    event.preventDefault();
    if (state.submitting) return;

    const now = Date.now();
    if (now < state.cooldownUntil) {
      const waitSeconds = Math.ceil((state.cooldownUntil - now) / 1000);
      setFeedback(`يرجى الانتظار ${waitSeconds} ثوانٍ قبل إرسال رسالة جديدة.`, "info");
      return;
    }

    const form = document.getElementById("tasleyaGlobalContactForm");
    const messageInput = document.getElementById("tasleyaGlobalContactMessage");
    const nameInput = document.getElementById("tasleyaGlobalContactName");
    const emailInput = document.getElementById("tasleyaGlobalContactEmail");
    const sendBtn = document.getElementById("tasleyaGlobalContactSend");

    const message = String(messageInput?.value || "").trim();
    const name = String(nameInput?.value || "").trim();
    const email = String(emailInput?.value || "").trim();

    if (!message) {
      setFeedback("الرجاء كتابة رسالة أولاً.", "error");
      return;
    }
    if (message.length < CONTACT_MIN_LENGTH) {
      setFeedback("الرسالة يجب أن تحتوي على 3 أحرف على الأقل.", "error");
      return;
    }
    if (message.length > CONTACT_MAX_LENGTH) {
      setFeedback("الرسالة طويلة جدًا. الحد الأقصى 1000 حرف.", "error");
      return;
    }
    if (email && !isValidEmail(email)) {
      setFeedback("يرجى إدخال بريد إلكتروني صحيح.", "error");
      return;
    }

    if (!form) {
      setFeedback("تعذّر إرسال الرسالة. حاول مرة أخرى.", "error");
      return;
    }

    state.submitting = true;
    if (sendBtn) sendBtn.disabled = true;
    setFeedback("جارٍ الإرسال...", "info");

    try {
      const formData = new FormData(form);
      formData.set("message", message);
      formData.set("name", name);
      formData.set("email", email);

      const response = await fetch(CONTACT_FORM_ACTION, {
        method: "POST",
        body: formData,
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        throw new Error(`Formspree request failed with status ${response.status}`);
      }

      state.cooldownUntil = Date.now() + CONTACT_SUBMIT_COOLDOWN_MS;
      form.reset();
      setFeedback("تم إرسال رسالتك بنجاح", "success");
      window.setTimeout(closeModal, 900);
    } catch (error) {
      setFeedback("تعذّر إرسال الرسالة. حاول مرة أخرى.", "error");
    } finally {
      state.submitting = false;
      if (sendBtn) sendBtn.disabled = false;
    }
  }

  function bindEvents() {
    const trigger = ensureTrigger();
    const modal = ensureModal();
    const form = document.getElementById("tasleyaGlobalContactForm");
    const closeBtn = document.getElementById("tasleyaGlobalContactClose");
    const messageInput = document.getElementById("tasleyaGlobalContactMessage");

    trigger.addEventListener("click", openModal);
    closeBtn?.addEventListener("click", closeModal);
    modal.addEventListener("click", (event) => {
      if (event.target === modal) closeModal();
    });
    form?.addEventListener("submit", submitMessage);
    messageInput?.addEventListener("keydown", (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        form?.requestSubmit();
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindEvents, { once: true });
  } else {
    bindEvents();
  }
})();

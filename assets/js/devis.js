(function () {
  function initQuoteForm(root = document) {
  const form = root.querySelector?.("#devis-form");
  if (!form || !window.InfoServ || form.dataset.infoservBound === "true") return;
  form.dataset.infoservBound = "true";
  const api = window.InfoServ;
  const filesInput = form.querySelector("#devis-files");
  const dropzone = form.querySelector(".dropzone");
  const dropLabel = form.querySelector("[data-drop-label]");
  const serviceField = form.querySelector("#devis-service");

  if (serviceField) {
    const requested = new URLSearchParams(window.location.search).get("service");
    if (requested) {
      const needle = requested.trim().toLowerCase();
      const match = [...serviceField.options].find((option) => {
        const value = option.value.toLowerCase();
        const label = option.textContent.trim().toLowerCase();
        return value === needle || label === needle || label.includes(needle);
      });
      if (match) serviceField.value = match.value;
    }
  }

  if (dropzone && filesInput) {
    const refresh = () => {
      if (!dropLabel) return;
      const count = filesInput.files.length;
      dropLabel.textContent = count
        ? count + " fichier(s) sélectionné(s)"
        : "Déposez vos fichiers ici ou parcourez";
    };
    dropzone.addEventListener("click", () => filesInput.click());
    ["dragenter", "dragover"].forEach((type) => {
      dropzone.addEventListener(type, (event) => {
        event.preventDefault();
        dropzone.classList.add("is-over");
      });
    });
    ["dragleave", "drop"].forEach((type) => {
      dropzone.addEventListener(type, (event) => {
        event.preventDefault();
        dropzone.classList.remove("is-over");
      });
    });
    dropzone.addEventListener("drop", (event) => {
      if (event.dataTransfer.files.length) {
        filesInput.files = event.dataTransfer.files;
        refresh();
      }
    });
    filesInput.addEventListener("change", refresh);
    dropzone.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        filesInput.click();
      }
    });
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const fields = {
      name: form.querySelector("#devis-name"),
      phone: form.querySelector("#devis-phone"),
      email: form.querySelector("#devis-email"),
      city: form.querySelector("#devis-city"),
      service: form.querySelector("#devis-service"),
      description: form.querySelector("#devis-description")
    };
    let ok = true;

    ok = api.required(fields.name, "votre nom et prénom") && ok;
    ok = api.required(fields.phone, "votre téléphone") && ok;
    ok = api.required(fields.email, "votre e-mail") && ok;
    ok = api.required(fields.city, "votre commune") && ok;
    ok = api.required(fields.service, "le type de service") && ok;
    ok = api.required(fields.description, "la description du besoin") && ok;

    if (fields.email.value && !api.emailPattern.test(fields.email.value)) {
      api.setError(fields.email, "L'adresse e-mail n'est pas valide.");
      ok = false;
    }
    if (fields.phone.value && !api.phonePattern.test(fields.phone.value)) {
      api.setError(fields.phone, "Le numéro de téléphone n'est pas valide.");
      ok = false;
    }

    const files = filesInput ? [...filesInput.files] : [];
    if (files.length > api.maxFiles) {
      api.setError(filesInput, "Cinq fichiers maximum.");
      ok = false;
    } else {
      const tooHeavy = files.find((file) => file.size > api.maxFileSize);
      const badType = files.find((file) => {
        const ext = "." + file.name.split(".").pop().toLowerCase();
        return !api.accepted.includes(ext);
      });
      if (tooHeavy) {
        api.setError(filesInput, "Chaque fichier doit rester inférieur à 8 Mo.");
        ok = false;
      } else if (badType) {
        api.setError(filesInput, "Format non accepté. Utilisez JPG, PNG, WEBP, PDF, DOC, DOCX ou TXT.");
        ok = false;
      } else if (filesInput) {
        api.setError(filesInput, "");
      }
    }

    if (!ok) {
      api.showStatus(form, "error", "Merci de corriger les champs indiqués.");
      return;
    }

    const send = api.sendSiteEmail
      ? api.sendSiteEmail({
          kind: "devis",
          name: fields.name.value,
          phone: fields.phone.value,
          email: fields.email.value,
          city: fields.city.value,
          service: fields.service.value,
          description: fields.description.value,
          files: files.map((file) => file.name).join(", "),
          website: form.querySelector("[name='website']")?.value || ""
        })
      : Promise.reject(new Error("send"));

    send.then((result) => {
      if (result.pendingActivation) {
        api.showStatus(form, "ok", result.message || "Un e-mail d’activation arrive dans " + (result.inbox || fields.email.value) + ". Confirmez-le, puis renvoyez la demande.");
        return;
      }
      if (!result.sent) throw new Error(result.error || "network");
      api.showStatus(form, "ok", "Votre demande de devis a bien été transmise vers " + (result.inbox || fields.email.value) + ". Les fichiers listés ne sont pas joints : envoyez-les ensuite en réponse si besoin.");
      document.dispatchEvent(new CustomEvent("infoserv:email-sent", {
        detail: {
          kind: "devis",
          inbox: result.inbox,
          replyTo: result.replyTo,
          name: fields.name.value,
          phone: fields.phone.value,
          email: fields.email.value,
          city: fields.city.value,
          service: fields.service.value,
          description: fields.description.value
        }
      }));
      form.reset();
    }).catch(() => {
      api.showStatus(form, "error", "L'envoi n'a pas pu aboutir. Vérifiez l’e-mail indiqué, puis réessayez.");
    });
  });
  }

  initQuoteForm();
  document.addEventListener("infoserv:content-changed", () => initQuoteForm(document.querySelector("#contenu")));
})();

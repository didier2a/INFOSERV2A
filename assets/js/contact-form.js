const contactForm = document.querySelector("#contact-form");
const contactStatus = contactForm?.querySelector(".form-status");
const quickChoices = document.querySelectorAll('input[name="quick-type"]');
const subjectField = document.querySelector("#subject");

quickChoices.forEach((choice) => {
  choice.addEventListener("change", () => {
    if (!subjectField) return;
    const matchingOption = Array.from(subjectField.options).find(
      (option) => option.textContent?.toLowerCase().includes(choice.value.toLowerCase())
    );
    if (matchingOption) subjectField.value = matchingOption.value || matchingOption.text;
    subjectField.focus({ preventScroll: true });
  });
});

contactForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!contactForm.checkValidity()) {
    contactForm.reportValidity();
    if (contactStatus) contactStatus.textContent = "Veuillez compléter les champs obligatoires.";
    return;
  }

  const data = new FormData(contactForm);
  const subject = encodeURIComponent(`Demande INFOSERV2A — ${data.get("subject") || "Contact"}`);
  const body = encodeURIComponent(
    [
      `Nom : ${data.get("name") || ""}`,
      `Entreprise : ${data.get("company") || ""}`,
      `Email : ${data.get("email") || ""}`,
      `Téléphone : ${data.get("phone") || ""}`,
      "",
      String(data.get("message") || ""),
    ].join("\n")
  );

  if (contactStatus) contactStatus.textContent = "Votre logiciel de messagerie va s’ouvrir.";
  window.location.href = `mailto:contact@infoserv2a.pro?subject=${subject}&body=${body}`;
});

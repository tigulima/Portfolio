const yearElement = document.getElementById("year");
if (yearElement) {
  yearElement.textContent = String(new Date().getFullYear());
}

const form = document.querySelector(".cta-form");
if (form) {
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const button = form.querySelector("button");
    if (button) {
      button.textContent = "Submitted!";
      button.setAttribute("disabled", "true");
    }
  });
}

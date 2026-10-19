const form = document.querySelector("#booking-form");
const emailInput = document.querySelector("#customer-email");
const emailError = document.querySelector("#email-error");
const serviceSelect = document.querySelector("#service");
const serviceTrigger = document.querySelector("#service-trigger");
const serviceLabel = document.querySelector("#selected-service-label");
const serviceOptions = document.querySelector("#service-options");
const professionalOptions = document.querySelector("#professional-options");
const dateInput = document.querySelector("#appointment-date");
const dateTrigger = document.querySelector("#date-trigger");
const dateCalendar = document.querySelector("#date-calendar");
const selectedWeekday = document.querySelector("#selected-weekday");
const selectedDateLabel = document.querySelector("#selected-date");
const calendarMonthLabel = document.querySelector("#calendar-month");
const calendarDays = document.querySelector("#calendar-days");
const previousMonthButton = document.querySelector("#previous-month");
const nextMonthButton = document.querySelector("#next-month");
const slotsContainer = document.querySelector("#time-slots");
const message = document.querySelector("#form-message");
let selectedSlot = null;
let selectedService = null;

function dateToValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateFromValue(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

function getFirstAvailableDate() {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  if (date.getDay() === 0) date.setDate(date.getDate() + 1);
  return date;
}

const todayValue = dateToValue(new Date());
let selectedDate = getFirstAvailableDate();
let displayedMonth = new Date(
  selectedDate.getFullYear(),
  selectedDate.getMonth(),
  1,
  12,
);

function updateDateDisplay() {
  dateInput.value = dateToValue(selectedDate);
  selectedWeekday.textContent = selectedDate.toLocaleDateString("pt-BR", {
    weekday: "long",
  });
  selectedDateLabel.textContent = selectedDate.toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function renderCalendar() {
  calendarMonthLabel.textContent = displayedMonth.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
  const currentMonth = new Date();
  currentMonth.setDate(1);
  currentMonth.setHours(12, 0, 0, 0);
  previousMonthButton.disabled = displayedMonth <= currentMonth;
  calendarDays.replaceChildren();

  const year = displayedMonth.getFullYear();
  const month = displayedMonth.getMonth();
  const firstDayOffset = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (let index = 0; index < firstDayOffset; index += 1) {
    const emptyCell = document.createElement("span");
    emptyCell.className = "calendar-empty";
    emptyCell.setAttribute("aria-hidden", "true");
    calendarDays.append(emptyCell);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month, day, 12);
    const dateValue = dateToValue(date);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "calendar-day";
    button.setAttribute("role", "gridcell");
    button.textContent = String(day);
    button.setAttribute("aria-label", date.toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }));
    button.setAttribute("aria-pressed", String(dateValue === dateInput.value));
    button.disabled = dateValue < todayValue || date.getDay() === 0;
    if (dateValue === todayValue) button.classList.add("is-today");
    if (date.getDay() === 0) button.classList.add("is-closed");
    button.addEventListener("click", () => {
      selectedDate = date;
      updateDateDisplay();
      renderCalendar();
      dateCalendar.hidden = true;
      dateTrigger.setAttribute("aria-expanded", "false");
      showMessage("");
      void loadTimeSlots();
    });
    calendarDays.append(button);
  }
}

updateDateDisplay();
renderCalendar();

async function loadOptions() {
  const [servicesResponse, professionalsResponse] = await Promise.all([
    fetch("/api/services"),
    fetch("/api/professionals"),
  ]);
  if (!servicesResponse.ok || !professionalsResponse.ok) {
    const failedResponse = !servicesResponse.ok
      ? servicesResponse
      : professionalsResponse;
    let details = "";
    try {
      const result = await failedResponse.json();
      details = result.error ? ` (${result.error})` : "";
    } catch {
      details = "";
    }
    throw new Error(
      `Não foi possível carregar serviços e barbeiros${details}`,
    );
  }

  const [services, professionals] = await Promise.all([
    servicesResponse.json(),
    professionalsResponse.json(),
  ]);

  serviceOptions.replaceChildren();
  for (const service of services) {
    const option = document.createElement("button");
    option.className = "service-option";
    option.type = "button";
    option.setAttribute("role", "option");
    option.setAttribute("aria-selected", "false");

    const details = document.createElement("span");
    details.className = "service-option-details";
    const name = document.createElement("strong");
    name.textContent = service.name;
    const description = document.createElement("span");
    description.textContent = `${service.duration_minutes} minutos`;
    details.append(name, description);

    const price = document.createElement("span");
    price.className = "service-option-price";
    price.textContent = (service.price_cents / 100).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
    option.append(details, price);
    option.addEventListener("click", () => {
      selectedService = service;
      serviceSelect.value = String(service.id);
      serviceLabel.textContent = `${service.name} · ${service.duration_minutes} min · ${price.textContent}`;
      serviceTrigger.setAttribute("aria-expanded", "false");
      serviceOptions.hidden = true;
      serviceOptions
        .querySelectorAll(".service-option")
        .forEach((item) => item.setAttribute("aria-selected", "false"));
      option.setAttribute("aria-selected", "true");
      showMessage("");
      void loadTimeSlots();
    });
    serviceOptions.append(option);
  }

  serviceLabel.textContent = services.length
    ? "Toque para ver os serviços e valores"
    : "Nenhum serviço cadastrado";

  professionalOptions.replaceChildren();
  const barberPhotos = [
    "/images/barbeiro-ilustracao-1.svg",
    "/images/barbeiro-ilustracao-2.svg",
  ];
  professionals.forEach((professional, index) => {
    const card = document.createElement("label");
    card.className = "professional-card";
    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "professionalId";
    radio.value = professional.id;
    radio.required = true;

    const image = document.createElement("img");
    image.src = barberPhotos[index % barberPhotos.length];
    image.alt = "";
    image.loading = "lazy";

    const name = document.createElement("strong");
    name.textContent = professional.name;
    const note = document.createElement("span");
    note.textContent = "Ilustração fictícia";

    const details = document.createElement("span");
    details.className = "professional-card-details";
    details.append(name, note);
    card.append(radio, image, details);
    radio.addEventListener("change", () => {
      showMessage("");
      void loadTimeSlots();
    });
    professionalOptions.append(card);
  });
}

serviceTrigger.addEventListener("click", () => {
  const isExpanded = serviceTrigger.getAttribute("aria-expanded") === "true";
  serviceTrigger.setAttribute("aria-expanded", String(!isExpanded));
  serviceOptions.hidden = isExpanded;
});

serviceOptions.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    serviceTrigger.setAttribute("aria-expanded", "false");
    serviceOptions.hidden = true;
    serviceTrigger.focus();
  }
});

dateTrigger.addEventListener("click", () => {
  const isExpanded = dateTrigger.getAttribute("aria-expanded") === "true";
  if (!isExpanded) {
    displayedMonth = new Date(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      1,
      12,
    );
    renderCalendar();
  }
  dateTrigger.setAttribute("aria-expanded", String(!isExpanded));
  dateCalendar.hidden = isExpanded;
});

previousMonthButton.addEventListener("click", () => {
  displayedMonth.setMonth(displayedMonth.getMonth() - 1);
  renderCalendar();
});

nextMonthButton.addEventListener("click", () => {
  displayedMonth.setMonth(displayedMonth.getMonth() + 1);
  renderCalendar();
});

dateCalendar.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    dateCalendar.hidden = true;
    dateTrigger.setAttribute("aria-expanded", "false");
    dateTrigger.focus();
  }
});

emailInput.addEventListener("invalid", () => {
  const error = emailInput.validity.valueMissing
    ? "Informe seu endereço de e-mail."
    : "Esse e-mail parece inválido. Confira o endereço e tente novamente.";
  emailInput.setCustomValidity(error);
  emailError.textContent = error;
});

emailInput.addEventListener("input", () => {
  emailInput.setCustomValidity("");
  emailError.textContent = "";
});

document.addEventListener("click", (event) => {
  if (
    !serviceTrigger.contains(event.target) &&
    !serviceOptions.contains(event.target)
  ) {
    serviceTrigger.setAttribute("aria-expanded", "false");
    serviceOptions.hidden = true;
  }
  if (
    !dateTrigger.contains(event.target) &&
    !dateCalendar.contains(event.target)
  ) {
    dateTrigger.setAttribute("aria-expanded", "false");
    dateCalendar.hidden = true;
  }
});

function showMessage(text, isSuccess = false) {
  message.textContent = text;
  message.classList.toggle("success", isSuccess);
}

function getLocalDateTime(date, minutes) {
  const hours = String(Math.floor(minutes / 60)).padStart(2, "0");
  const minute = String(minutes % 60).padStart(2, "0");
  return new Date(`${date}T${hours}:${minute}:00`);
}

async function loadTimeSlots() {
  slotsContainer.replaceChildren();
  selectedSlot = null;
  const selectedProfessional = form.querySelector(
    'input[name="professionalId"]:checked',
  );

  if (!selectedService || !selectedProfessional || !dateInput.value) {
    slotsContainer.innerHTML =
      '<p class="slots-hint">Escolha o serviço, o barbeiro e o dia.</p>';
    return;
  }

  slotsContainer.innerHTML = '<p class="slots-hint">Buscando horários...</p>';
  const date = dateInput.value;
  if (getLocalDateTime(date, 12).getDay() === 0) {
    slotsContainer.innerHTML =
      '<p class="slots-hint">A barbearia não abre aos domingos.</p>';
    return;
  }
  const dayStart = getLocalDateTime(date, 0);
  const dayEnd = getLocalDateTime(date, 24 * 60);
  const params = new URLSearchParams({
    from: dayStart.toISOString(),
    to: dayEnd.toISOString(),
    professionalId: selectedProfessional.value,
  });

  try {
    const response = await fetch(`/api/appointments?${params}`);
    if (!response.ok) throw new Error("Falha ao consultar horários.");
    const appointments = await response.json();
    const duration = Number(selectedService.duration_minutes);
    const now = new Date();
    slotsContainer.replaceChildren();

    for (let minutes = 9 * 60; minutes + duration <= 19 * 60; minutes += 30) {
      const startsAt = getLocalDateTime(date, minutes);
      const endsAt = new Date(startsAt.getTime() + duration * 60_000);
      const isTaken = appointments.some(
        (appointment) =>
          startsAt < new Date(appointment.ends_at) &&
          endsAt > new Date(appointment.starts_at),
      );
      if (startsAt <= now || isTaken) continue;

      const button = document.createElement("button");
      button.className = "slot-button";
      button.type = "button";
      button.textContent = startsAt.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      });
      button.addEventListener("click", () => {
        selectedSlot = startsAt;
        slotsContainer
          .querySelectorAll(".slot-button")
          .forEach((slot) => slot.setAttribute("aria-pressed", "false"));
        button.setAttribute("aria-pressed", "true");
        showMessage("");
      });
      button.setAttribute("aria-pressed", "false");
      slotsContainer.append(button);
    }

    if (slotsContainer.childElementCount === 0) {
      slotsContainer.innerHTML =
        '<p class="slots-hint">Não há horários livres para este dia.</p>';
    }
  } catch {
    slotsContainer.innerHTML =
      '<p class="slots-hint">Não foi possível consultar os horários. Tente novamente.</p>';
  }
}

for (const field of [dateInput]) {
  field.addEventListener("change", () => {
    showMessage("");
    void loadTimeSlots();
  });
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!dateInput.value) {
    showMessage("Escolha o dia do corte.");
    dateTrigger.focus();
    return;
  }
  if (!selectedService) {
    showMessage("Escolha um serviço para continuar.");
    serviceTrigger.focus();
    return;
  }
  const selectedProfessional = form.querySelector(
    'input[name="professionalId"]:checked',
  );
  if (!selectedProfessional) {
    showMessage("Escolha o barbeiro que vai atender você.");
    professionalOptions.querySelector('input[name="professionalId"]')?.focus();
    return;
  }
  if (!selectedSlot) {
    showMessage("Escolha um dos horários disponíveis.");
    return;
  }

  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  showMessage("");

  try {
    const response = await fetch("/api/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerName: form.elements.customerName.value,
        customerEmail: form.elements.customerEmail.value,
        professionalId: Number(selectedProfessional.value),
        serviceId: Number(selectedService.id),
        startsAt: selectedSlot.toISOString(),
      }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "Não foi possível agendar.");

    showMessage(
      result.confirmationSent
        ? "Horário confirmado! Enviamos os detalhes para seu e-mail."
        : "Horário confirmado! O envio de e-mail ainda não está configurado.",
      true,
    );
    form.reset();
    selectedDate = getFirstAvailableDate();
    displayedMonth = new Date(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      1,
      12,
    );
    updateDateDisplay();
    renderCalendar();
    selectedService = null;
    serviceSelect.value = "";
    serviceLabel.textContent = "Toque para ver os serviços e valores";
    serviceOptions
      .querySelectorAll(".service-option")
      .forEach((option) => option.setAttribute("aria-selected", "false"));
    selectedSlot = null;
    await loadTimeSlots();
  } catch (error) {
    showMessage(
      error instanceof Error ? error.message : "Não foi possível agendar.",
    );
    await loadTimeSlots();
  } finally {
    submitButton.disabled = false;
  }
});

loadOptions()
  .then(loadTimeSlots)
  .catch((error) => {
    showMessage(error.message);
    slotsContainer.innerHTML =
      '<p class="slots-hint">Não foi possível carregar os dados da agenda.</p>';
  });

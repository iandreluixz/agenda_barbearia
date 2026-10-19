const form = document.querySelector("#booking-form");
const serviceSelect = document.querySelector("#service");
const professionalSelect = document.querySelector("#professional");
const dateInput = document.querySelector("#appointment-date");
const slotsContainer = document.querySelector("#time-slots");
const message = document.querySelector("#form-message");
let selectedSlot = null;

const today = new Date();
const localDate = new Date(today.getTime() - today.getTimezoneOffset() * 60_000)
  .toISOString()
  .slice(0, 10);
dateInput.min = localDate;
dateInput.value = localDate;

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

  serviceSelect.innerHTML = '<option value="">Selecione um serviço</option>';
  for (const service of services) {
    const option = document.createElement("option");
    option.value = service.id;
    option.textContent = `${service.name} · ${service.duration_minutes} min · ${(service.price_cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`;
    serviceSelect.append(option);
  }

  professionalSelect.innerHTML =
    '<option value="">Selecione um barbeiro</option>';
  for (const professional of professionals) {
    const option = document.createElement("option");
    option.value = professional.id;
    option.textContent = professional.name;
    professionalSelect.append(option);
  }
}

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

  if (!serviceSelect.value || !professionalSelect.value || !dateInput.value) {
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
    professionalId: professionalSelect.value,
  });

  try {
    const response = await fetch(`/api/appointments?${params}`);
    if (!response.ok) throw new Error("Falha ao consultar horários.");
    const appointments = await response.json();
    const duration = Number(
      serviceSelect.selectedOptions[0].dataset.duration ??
        serviceSelect.selectedOptions[0].textContent.match(/· (\d+) min/)?.[1],
    );
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

for (const field of [serviceSelect, professionalSelect, dateInput]) {
  field.addEventListener("change", () => {
    showMessage("");
    void loadTimeSlots();
  });
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
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
        professionalId: Number(professionalSelect.value),
        serviceId: Number(serviceSelect.value),
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
    dateInput.value = localDate;
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

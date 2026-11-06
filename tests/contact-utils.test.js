"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildAppointmentMessage,
  formatBrazilianMobile,
  isValidBrazilianMobile,
  normalizeBrazilianMobile
} = require("../legacy/contact-utils.js");

test("formats and validates Brazilian mobile numbers with DDD", () => {
  assert.equal(formatBrazilianMobile("41999991234"), "(41) 99999-1234");
  assert.equal(formatBrazilianMobile("+55 (41) 99999-1234"), "(41) 99999-1234");
  assert.equal(isValidBrazilianMobile("(41) 99999-1234"), true);
  assert.equal(isValidBrazilianMobile("(41) 3333-1234"), false);
  assert.equal(normalizeBrazilianMobile("(41) 99999-1234"), "5541999991234");
});

test("cancellation message uses the correct customer, shop, appointment, professional and service", () => {
  const message = buildAppointmentMessage({
    kind: "cancelled",
    customerName: "João",
    shopName: "Barbearia XYZ",
    serviceName: "Corte + Barba",
    staffName: "Carlos",
    date: "2026-11-15",
    time: "14:00"
  });

  assert.match(message, /Olá João,/);
  assert.match(message, /Barbearia XYZ foi cancelado/);
  assert.match(message, /Serviço: Corte \+ Barba/);
  assert.match(message, /Profissional: Carlos/);
  assert.match(message, /Data: 15\/11\/2026/);
  assert.match(message, /Horário: 14:00/);
});

test("confirmation message includes appointment data", () => {
  const message = buildAppointmentMessage({
    kind: "created",
    customerName: "João",
    shopName: "Barbearia XYZ",
    serviceName: "Corte",
    staffName: "Carlos",
    date: "2026-11-15",
    time: "14:00"
  });

  assert.match(message, /Agendamento confirmado/);
  assert.match(message, /Serviço: Corte/);
  assert.match(message, /Profissional: Carlos/);
  assert.match(message, /Data: 15\/11\/2026/);
});

test("reschedule message clearly indicates that the appointment time changed", () => {
  const message = buildAppointmentMessage({
    kind: "rescheduled",
    customerName: "João",
    shopName: "Barbearia XYZ",
    serviceName: "Corte",
    staffName: "Carlos",
    date: "2026-11-16",
    time: "15:30"
  });

  assert.match(message, /Agendamento reagendado/);
  assert.match(message, /reagendado/);
  assert.match(message, /Data: 16\/11\/2026/);
  assert.match(message, /Horário: 15:30/);
});

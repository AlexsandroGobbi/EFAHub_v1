(function (root, factory) {
  const utilities = factory();
  root.EFAHubUtils = utilities;
  if (typeof module !== "undefined" && module.exports) module.exports = utilities;
})(globalThis, function () {
  function phoneDigits(value) {
    let digits = String(value || "").replace(/\D/g, "");
    if (digits.startsWith("55") && digits.length === 13) digits = digits.slice(2);
    return digits;
  }

  function isValidBrazilianMobile(value) {
    return /^(?:11|12|13|14|15|16|17|18|19|21|22|24|27|28|31|32|33|34|35|37|38|41|42|43|44|45|46|47|48|49|51|53|54|55|61|62|63|64|65|66|67|68|69|71|73|74|75|77|79|81|82|83|84|85|86|87|88|89|91|92|93|94|95|96|97|98|99)9\d{8}$/.test(phoneDigits(value));
  }

  function formatBrazilianMobile(value) {
    const digits = phoneDigits(value).slice(0, 11);
    if (digits.length <= 2) return digits ? `(${digits}` : "";
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}${digits.length > 7 ? `-${digits.slice(7)}` : ""}`;
  }

  function normalizeBrazilianMobile(value) {
    if (!isValidBrazilianMobile(value)) return null;
    return `55${phoneDigits(value)}`;
  }

  function buildAppointmentMessage({ kind, customerName, shopName, serviceName, staffName, date, time }) {
    const headings = {
      created: "Agendamento confirmado",
      rescheduled: "Agendamento reagendado",
      professional: "Profissional atualizado",
      service: "Serviço atualizado",
      updated: "Agendamento atualizado",
      cancelled: "Agendamento cancelado"
    };
    const descriptions = {
      created: "Seu horário foi confirmado com sucesso.",
      rescheduled: "Seu agendamento foi reagendado. Confira os novos dados:",
      professional: "O profissional do seu agendamento foi alterado. Confira os dados atualizados:",
      service: "O serviço do seu agendamento foi alterado. Confira os dados atualizados:",
      updated: "Os dados do seu agendamento foram atualizados:"
    };
    const heading = headings[kind] || headings.updated;
    const dateLabel = /^\d{4}-\d{2}-\d{2}$/.test(date || "")
      ? `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`
      : "data não informada";
    const appointmentDetails = [
      `Serviço: ${serviceName || "Atendimento"}`,
      `Profissional: ${staffName || "A definir"}`,
      `Data: ${dateLabel}`,
      `Horário: ${time || "não informado"}`
    ];

    if (kind === "cancelled") {
      return [
        heading,
        "",
        `Olá ${customerName || "cliente"},`,
        `Seu agendamento na ${shopName || "barbearia"} foi cancelado.`,
        "",
        ...appointmentDetails,
        "",
        "Se quiser, podemos ajudar a escolher um novo horário.",
        shopName || "EFAHub"
      ].join("\n");
    }

    return [
      heading,
      "",
      `Olá ${customerName || "cliente"},`,
      descriptions[kind] || descriptions.updated,
      "",
      ...appointmentDetails,
      "",
      "Aguardamos você.",
      shopName || "EFAHub"
    ].join("\n");
  }

  return {
    buildAppointmentMessage,
    formatBrazilianMobile,
    isValidBrazilianMobile,
    normalizeBrazilianMobile
  };
});

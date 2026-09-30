import type { LegalDoc } from "../../components/LegalScreen";

const UPDATED = "30 de setembro de 2026";

export const COOKIES: LegalDoc = {
  title: "Política de Cookies",
  updated: UPDATED,
  intro: "Como a AgriLink usa cookies e tecnologias semelhantes.",
  sections: [
    {
      title: "O que são",
      body: [
        "Cookies são pequenos ficheiros guardados no dispositivo. Na aplicação móvel usamos também tecnologias equivalentes, como identificadores do dispositivo e armazenamento local.",
      ],
    },
    {
      title: "Que tecnologias usamos",
      body: [
        "- Essenciais: manter a sessão iniciada, autenticação e segurança.",
        "- Preferências: lembrar definições como idioma e privacidade.",
        "- Desempenho e análise: perceber como a app é usada e corrigir erros.",
      ],
    },
    {
      title: "Como gerir",
      body: [
        "As tecnologias essenciais não podem ser desativadas sem afetar o serviço. Podes limitar as restantes nas definições do teu dispositivo ou, no website, do teu navegador.",
      ],
    },
    {
      title: "Contactos",
      body: ["Dúvidas: privacidade@agrilink.ao"],
    },
  ],
};

export const ORDERS: LegalDoc = {
  title: "Pedidos e Cancelamentos",
  updated: UPDATED,
  intro: "Como funcionam pedidos, acordos, cancelamentos e reembolsos entre compradores e produtores.",
  sections: [
    {
      title: "Como funciona um pedido",
      body: [
        "O comprador envia um pedido com produto, quantidade e condições. O produtor pode aceitar, recusar ou propor alterações. O acordo só é vinculativo após aceitação expressa do produtor.",
      ],
    },
    {
      title: "Preço e condições",
      body: [
        "Preço, quantidade, prazo, local e forma de pagamento devem ficar registados na aplicação. Alterações posteriores exigem acordo de ambas as partes.",
      ],
    },
    {
      title: "Cancelamento pelo comprador",
      body: [
        "- Antes da aceitação: pode cancelar sem penalização.",
        "- Depois da aceitação e antes da preparação/expedição: deve avisar o produtor o mais cedo possível; o produtor pode reter custos já incorridos e justificados.",
        "- Produtos perecíveis já colhidos ou preparados para o comprador podem não ser cancelável.",
      ],
    },
    {
      title: "Cancelamento pelo produtor",
      body: [
        "O produtor só deve cancelar por motivo justificado (por exemplo, perda de colheita ou indisponibilidade). Deve avisar de imediato e devolver qualquer valor já recebido.",
      ],
    },
    {
      title: "Incumprimentos",
      body: [
        "Considera-se incumprimento a não entrega, o atraso significativo, a recusa injustificada de recebimento ou o não pagamento. Incumprimentos repetidos podem levar a avisos, limitação de funcionalidades ou suspensão da conta.",
      ],
    },
    {
      title: "Reembolsos",
      body: [
        "Havendo pagamento e cancelamento válido, ou não conformidade comprovada, o reembolso é devido pela parte que o recebeu, dentro de prazo razoável e pelo mesmo meio, salvo outro acordo. A AgriLink pode mediar, sem garantir o resultado.",
      ],
    },
    {
      title: "Direitos do consumidor",
      body: ["Esta política não afeta os direitos que a lei angolana de defesa do consumidor confira a compradores que sejam consumidores."],
    },
  ],
};

export const QUALITY: LegalDoc = {
  title: "Qualidade e Conformidade",
  updated: UPDATED,
  intro: "O que esperamos dos produtos publicados e como tratamos reclamações.",
  sections: [
    {
      title: "Princípios",
      body: ["Os produtos devem ser seguros, corresponder à descrição e respeitar a legislação sanitária e fitossanitária aplicável."],
    },
    {
      title: "Descrição correta",
      body: [
        "- Nome, categoria, origem e estado (fresco, processado, etc.).",
        "- Calibre, maturação e condições de conservação, quando relevantes.",
        "- Fotografias reais e atuais.",
        "- Quantidade e unidade de medida claras.",
      ],
    },
    {
      title: "Produtos não permitidos",
      body: [
        "- Produtos estragados, contaminados, fora de validade ou impróprios para consumo.",
        "- Produtos cuja venda seja proibida ou exija licença que o produtor não tenha.",
        "- Produtos com uso indevido de pesticidas ou substâncias não autorizadas.",
      ],
    },
    {
      title: "Inspeção na entrega",
      body: [
        "O comprador deve verificar a mercadoria na receção e reportar não conformidades, de preferência com fotografias, no prazo de 24 horas para produtos perecíveis, ou de 72 horas para os restantes, salvo acordo diferente.",
      ],
    },
    {
      title: "Reclamações",
      body: [
        "Reclamações são feitas pela aplicação ou por suporte@agrilink.ao. Analisamos as provas de ambas as partes e podemos sugerir solução, como substituição, desconto ou reembolso. Produtores com não conformidades recorrentes podem ser limitados ou removidos.",
      ],
    },
    {
      title: "Verificação",
      body: ["A AgriLink pode solicitar documentação ou realizar verificações por amostragem. Um selo de verificação não substitui a inspeção do comprador."],
    },
  ],
};

export const ACCEPTABLE_USE: LegalDoc = {
  title: "Utilização Aceitável",
  updated: UPDATED,
  intro: "Regras de conduta para manter a AgriLink segura e de confiança.",
  sections: [
    {
      title: "Respeito e boa-fé",
      body: ["Trata os outros utilizadores com respeito. Não são toleradas ofensas, discriminação, assédio, ameaças ou linguagem de ódio."],
    },
    {
      title: "Conteúdo permitido",
      body: [
        "Publica apenas conteúdo verdadeiro e relacionado com a atividade agrícola e comercial da plataforma, sobre o qual tenhas direitos.",
      ],
    },
    {
      title: "Conteúdo proibido",
      body: [
        "- Conteúdo ilegal, violento, sexual ou ofensivo.",
        "- Publicidade enganosa, spam ou mensagens em massa não solicitadas.",
        "- Dados pessoais de terceiros sem autorização.",
        "- Conteúdo que viole direitos de autor ou marcas.",
      ],
    },
    {
      title: "Condutas técnicas proibidas",
      body: [
        "- Tentar aceder a contas ou sistemas sem autorização.",
        "- Usar robôs, scraping ou meios automáticos para recolher dados.",
        "- Introduzir vírus ou interferir no funcionamento da plataforma.",
        "- Contornar medidas de segurança.",
      ],
    },
    {
      title: "Avaliações e reputação",
      body: ["Avaliações devem refletir experiências reais. É proibido criar avaliações falsas ou pagas, ou pressionar alguém para alterar a sua avaliação."],
    },
    {
      title: "Denúncias e consequências",
      body: [
        "Podes denunciar conteúdo ou utilizadores suspeitos através do suporte. Violações podem levar a remoção de conteúdo, aviso, suspensão ou encerramento da conta, e comunicação às autoridades quando necessário.",
      ],
    },
  ],
};

export const LOGISTICS: LegalDoc = {
  title: "Logística e Entregas",
  updated: UPDATED,
  intro: "Como combinar transporte, prazos e riscos de entrega.",
  sections: [
    {
      title: "Modalidades",
      body: [
        "- Levantamento pelo comprador na propriedade do produtor.",
        "- Entrega pelo produtor.",
        "- Transportador terceiro contratado por uma das partes.",
        "A modalidade, o custo e quem o suporta devem ser acordados antes da confirmação do pedido.",
      ],
    },
    {
      title: "Prazos e local",
      body: ["Data, horário e local de entrega devem ser claros. Em caso de atraso, a parte afetada deve avisar logo que possível e acordar nova data."],
    },
    {
      title: "Embalagem e transporte",
      body: [
        "O produtor deve embalar de forma adequada à natureza do produto. Produtos perecíveis exigem transporte que preserve a qualidade (proteção de calor, ventilação e higiene).",
      ],
    },
    {
      title: "Transferência de risco",
      body: [
        "Salvo acordo diferente, o risco passa para o comprador com a entrega ou levantamento. Se o transporte for feito por terceiro escolhido pelo produtor, o risco mantém-se com o produtor até à entrega ao comprador.",
      ],
    },
    {
      title: "Receção e confirmação",
      body: ["O comprador deve conferir a mercadoria e confirmar a receção na aplicação. Danos ou faltas devem ser reportados e fotografados no momento."],
    },
    {
      title: "Segurança",
      body: [
        "Combina entregas em locais seguros e conhecidos. Desconfia de pedidos de alteração súbita de local ou de pagamento adiantado fora da plataforma.",
      ],
    },
    {
      title: "Papel da AgriLink",
      body: ["Salvo quando oferecer expressamente um serviço logístico, a AgriLink não transporta nem garante entregas e não responde por perdas ou danos no transporte."],
    },
  ],
};
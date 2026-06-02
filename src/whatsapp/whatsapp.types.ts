export type WhatsappIncomingMessage = {
  id: string;
  from: string;
  timestamp?: string;
  type: string;
  text?: {
    body?: string;
  };
  button?: {
    text?: string;
    payload?: string;
  };
  interactive?: {
    button_reply?: {
      id?: string;
      title?: string;
    };
    list_reply?: {
      id?: string;
      title?: string;
    };
  };
};

export type WhatsappWebhookBody = {
  object?: string;
  entry?: {
    changes?: {
      value?: {
        messages?: WhatsappIncomingMessage[];
      };
    }[];
  }[];
};

export type InvitationBotDraft = {
  groomName?: string;
  brideName?: string;
  eventDateTime?: string;
  eventLocation?: string;
  mapUrl?: string;
  brideParents?: string;
  groomParents?: string;
  quoteText?: string;
};

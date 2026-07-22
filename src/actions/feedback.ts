"use server";
import type { SendFeedbackActionState } from "@/types/feedback";
import { Resend } from "resend";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_CONTENT_LENGTH = 5000;

export async function sendFeedback(
  _prevState: SendFeedbackActionState | null,
  formData: FormData,
): Promise<SendFeedbackActionState> {
  const input = {
    name: (formData.get("name")?.toString() ?? "").trim(),
    email: (formData.get("email")?.toString() ?? "").trim(),
    content: (formData.get("content")?.toString() ?? "").trim(),
  };

  if (!input.name || !input.email || !input.content) {
    return { error: "Vennligst fyll ut alle feltene.", input };
  }

  if (!EMAIL_REGEX.test(input.email)) {
    return { error: "Ugyldig e-postadresse.", input };
  }

  if (input.content.length > MAX_CONTENT_LENGTH) {
    return { error: "Tilbakemeldingen er for lang.", input };
  }

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.LINEAR_ISSUE_EMAIL;

  if (!apiKey || !to) {
    console.error(
      "Feedback not sent: RESEND_API_KEY or LINEAR_ISSUE_EMAIL is not configured.",
    );
    return { error: "Noe gikk galt, prøv igjen.", input };
  }

  const resend = new Resend(apiKey);

  try {
    const { error } = await resend.emails.send({
      from: "feedback@hvor.app",
      to: [to],
      subject: `${input.name} - ${input.email}`,
      text: input.content,
    });

    if (error) {
      console.error("Failed to send feedback email:", error);
      return { error: "Noe gikk galt, prøv igjen.", input };
    }

    return { message: "Takk for din tilbakemelding!", input };
  } catch (error) {
    console.error("Failed to send feedback email:", error);
    return { error: "Noe gikk galt, prøv igjen.", input };
  }
}

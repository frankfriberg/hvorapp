"use client";
import { sendFeedback } from "@/actions/feedback";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submitButton";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { useActionState } from "react";

export default function FeedbackPage() {
  const [state, formAction] = useActionState(sendFeedback, {});

  return (
    <div className="flex flex-col gap-3 px-6 py-3">
      <h1 className="mb-3 text-2xl font-bold">Gi din tilbakemelding</h1>
      <p>
        Hvis du har funnet en feil, eller om det er noe du vil skal være
        annerledes, eller har du en god ide til appen.
      </p>
      <form className="my-3 flex flex-col space-y-4" action={formAction}>
        <Label htmlFor="name">
          Navn
          <Input
            name="name"
            className="mt-2"
            required
            defaultValue={state.input?.name}
          />
        </Label>
        <Label htmlFor="email">
          Email
          <Input
            name="email"
            type="email"
            className="mt-2"
            required
            defaultValue={state.input?.email}
          />
        </Label>
        <Label htmlFor="content">
          Tilbakemelding
          <Textarea
            name="content"
            className="mt-2"
            required
            defaultValue={state.input?.content}
          />
        </Label>
        {state.message && (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>Motatt</AlertTitle>
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        )}
        {state.error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error!</AlertTitle>
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        )}
        <SubmitButton disabled={!!state.message}>Send</SubmitButton>
      </form>
    </div>
  );
}

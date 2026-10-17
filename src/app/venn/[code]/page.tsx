import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { userByInviteCode } from "@/server/accounts";
import { getDb } from "@/server/db";

type Props = {
  params: Promise<{ code: string }>;
};

async function inviter(code: string) {
  return userByInviteCode(await getDb(), code);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const owner = await inviter((await params).code);
  return {
    title: owner ? `${owner.name} vil bli venn med deg` : "Hvor",
    description: "Se hvor vennene dine sitter.",
  };
}

/**
 * Where an invite link lands when the app doesn't open it: names the inviter
 * and hands the code to the app.
 */
export default async function InvitePage({ params }: Props) {
  const { code } = await params;
  const owner = await inviter(code);

  if (!owner) {
    return (
      <div className="flex flex-col gap-3 px-6 py-3">
        <h1 className="text-2xl font-bold">Ugyldig invitasjon</h1>
        <p>Denne lenken peker ikke til noen på Hvor.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 px-6 py-3">
      <h1 className="text-2xl font-bold">{owner.name} vil bli venn med deg</h1>
      <p>Åpne invitasjonen i Hvor-appen for å se hvor vennene dine sitter.</p>
      <Button asChild size="lg">
        <a href={`hvor://venn/${encodeURIComponent(code)}`}>Åpne i appen</a>
      </Button>
    </div>
  );
}

import { I18nManager, Platform, Settings } from "react-native";

// The app's words in each language it speaks. Norwegian is the original and
// the fallback; the phone's language picks one when the app starts.

const nb = {
  locale: "nb-NO",
  // Header titles
  friends: "Venner",
  signIn: "Logg inn",
  invitation: "Invitasjon",
  // The map and sharing
  shareSeatWithFriends: "Del plassen med venner",
  shareLocation: "Del plassering",
  shareWithFriendsTitle: "Del med vennene dine",
  shareForHowLong: "Hvor lenge skal de se plassen din?",
  hours: (n: number) => (n === 1 ? "1 time" : `${n} timer`),
  cancel: "Avbryt",
  sharedWithFriends: "Delt med vennene dine",
  theySeeYourSeatUntil: (time: string) => `De ser plassen din til ${time}.`,
  stopSharing: "Slutt å dele",
  couldNotStopSharing: "Kunne ikke slutte å dele",
  couldNotShare: "Kunne ikke dele",
  checkNetwork: "Sjekk nettet og prøv igjen.",
  sitsHere: (name: string) => `${name} sitter her`,
  // The shared image and link
  shareTitle: "Her sitter jeg!",
  bannerHeadline: "Hvor sitter du?",
  bannerBody: "Vis vennene dine plassen din — hvor.app",
  // Opening a seat link
  iSitHere: "Jeg sitter her",
  invalidLocation: "Ugyldig plassering",
  invalidLocationBody: "Denne lenken peker ikke til en gyldig plassering.",
  // Opening an invite link
  requestSent: (name: string) =>
    `Forespørsel sendt til ${name}. Du ser plassen deres når de godtar.`,
  nowFriends: (name: string) => `Du og ${name} er nå venner.`,
  alreadyFriends: (name: string) => `Du og ${name} er allerede venner.`,
  ownInvite: "Dette er din egen invitasjonslenke. Send den til vennene dine.",
  unknownInvite: "Denne invitasjonen finnes ikke.",
  couldNotOpenInvite:
    "Kunne ikke åpne invitasjonen. Sjekk nettet og prøv igjen.",
  toYourFriends: "Til vennene dine",
  // Signing in
  signInFailed: "Innlogging feilet",
  tryAgainLater: "Prøv igjen om litt.",
  whatsYourName: "Hva heter du?",
  friendsSeeYourName: "Vennene dine ser navnet ditt.",
  name: "Navn",
  continue: "Fortsett",
  signInToShare: "Logg inn for å dele med venner",
  signInWhy: "Vennene dine ser hvor du sitter, og du ser hvor de sitter.",
  signInWithGoogle: "Logg inn med Google",
  devSignIn: "Utvikling: logg inn med navn",
  // Friends
  sitsInSalenUntil: (time: string) => `Sitter i Salen · deler til ${time}`,
  notSharing: "Deler ikke plassen sin nå",
  signInForFriends: "Logg inn for å legge til venner og se hvor de sitter.",
  somethingWentWrong: "Noe gikk galt",
  inviteMessage: (url: string) =>
    `Bli venn med meg på Hvor, så ser vi hvor hverandre sitter: ${url}`,
  removeFriend: (name: string) => `Fjerne ${name}?`,
  removeFriendBody: "Dere slutter å se hverandres plass.",
  remove: "Fjern",
  deleteAccountTitle: "Slette kontoen?",
  deleteAccountBody:
    "Vennene og plassene du har delt slettes. Dette kan ikke angres.",
  delete: "Slett",
  couldNotDelete: "Kunne ikke slette",
  inviteFriend: "Inviter en venn",
  wantsToBeFriends: "Vil bli venn med deg",
  accept: "Godta",
  decline: "Avslå",
  noFriendsYet: "Ingen venner ennå. Send invitasjonslenken din til noen.",
  awaitingReply: "Venter på svar",
  withdraw: "Trekk tilbake",
  signedInAs: (name: string) => `Logget inn som ${name}`,
  signOut: "Logg ut",
  deleteAccount: "Slett konto",
};

type Strings = typeof nb;

const en: Strings = {
  locale: "en-GB",
  friends: "Friends",
  signIn: "Sign in",
  invitation: "Invitation",
  shareSeatWithFriends: "Share your seat with friends",
  shareLocation: "Share location",
  shareWithFriendsTitle: "Share with your friends",
  shareForHowLong: "How long should they see your seat?",
  hours: (n) => (n === 1 ? "1 hour" : `${n} hours`),
  cancel: "Cancel",
  sharedWithFriends: "Shared with your friends",
  theySeeYourSeatUntil: (time) => `They can see your seat until ${time}.`,
  stopSharing: "Stop sharing",
  couldNotStopSharing: "Couldn't stop sharing",
  couldNotShare: "Couldn't share",
  checkNetwork: "Check your connection and try again.",
  sitsHere: (name) => `${name} is sitting here`,
  shareTitle: "I'm sitting here!",
  bannerHeadline: "Where are you sitting?",
  bannerBody: "Show your friends your seat — hvor.app",
  iSitHere: "I'm sitting here",
  invalidLocation: "Invalid location",
  invalidLocationBody: "This link doesn't point to a valid location.",
  requestSent: (name) =>
    `Request sent to ${name}. You'll see their seat once they accept.`,
  nowFriends: (name) => `You and ${name} are now friends.`,
  alreadyFriends: (name) => `You and ${name} are already friends.`,
  ownInvite: "This is your own invite link. Send it to your friends.",
  unknownInvite: "This invitation doesn't exist.",
  couldNotOpenInvite:
    "Couldn't open the invitation. Check your connection and try again.",
  toYourFriends: "Go to your friends",
  signInFailed: "Sign-in failed",
  tryAgainLater: "Try again in a moment.",
  whatsYourName: "What's your name?",
  friendsSeeYourName: "Your friends will see your name.",
  name: "Name",
  continue: "Continue",
  signInToShare: "Sign in to share with friends",
  signInWhy:
    "Your friends see where you're sitting, and you see where they are.",
  signInWithGoogle: "Sign in with Google",
  devSignIn: "Development: sign in with a name",
  sitsInSalenUntil: (time) => `Sitting in Salen · sharing until ${time}`,
  notSharing: "Not sharing their seat right now",
  signInForFriends: "Sign in to add friends and see where they're sitting.",
  somethingWentWrong: "Something went wrong",
  inviteMessage: (url) =>
    `Be my friend on Hvor, so we can see where each other is sitting: ${url}`,
  removeFriend: (name) => `Remove ${name}?`,
  removeFriendBody: "You'll stop seeing each other's seats.",
  remove: "Remove",
  deleteAccountTitle: "Delete your account?",
  deleteAccountBody:
    "Your friends and the seats you've shared will be deleted. This can't be undone.",
  delete: "Delete",
  couldNotDelete: "Couldn't delete",
  inviteFriend: "Invite a friend",
  wantsToBeFriends: "Want to be your friend",
  accept: "Accept",
  decline: "Decline",
  noFriendsYet: "No friends yet. Send your invite link to someone.",
  awaitingReply: "Waiting for a reply",
  withdraw: "Withdraw",
  signedInAs: (name) => `Signed in as ${name}`,
  signOut: "Sign out",
  deleteAccount: "Delete account",
};

const sv: Strings = {
  locale: "sv-SE",
  friends: "Vänner",
  signIn: "Logga in",
  invitation: "Inbjudan",
  shareSeatWithFriends: "Dela platsen med vänner",
  shareLocation: "Dela plats",
  shareWithFriendsTitle: "Dela med dina vänner",
  shareForHowLong: "Hur länge ska de se din plats?",
  hours: (n) => (n === 1 ? "1 timme" : `${n} timmar`),
  cancel: "Avbryt",
  sharedWithFriends: "Delad med dina vänner",
  theySeeYourSeatUntil: (time) => `De ser din plats till ${time}.`,
  stopSharing: "Sluta dela",
  couldNotStopSharing: "Kunde inte sluta dela",
  couldNotShare: "Kunde inte dela",
  checkNetwork: "Kontrollera anslutningen och försök igen.",
  sitsHere: (name) => `${name} sitter här`,
  shareTitle: "Här sitter jag!",
  bannerHeadline: "Var sitter du?",
  bannerBody: "Visa dina vänner din plats — hvor.app",
  iSitHere: "Här sitter jag",
  invalidLocation: "Ogiltig plats",
  invalidLocationBody: "Den här länken pekar inte på en giltig plats.",
  requestSent: (name) =>
    `Förfrågan skickad till ${name}. Du ser deras plats när de godkänner.`,
  nowFriends: (name) => `Du och ${name} är nu vänner.`,
  alreadyFriends: (name) => `Du och ${name} är redan vänner.`,
  ownInvite:
    "Det här är din egen inbjudningslänk. Skicka den till dina vänner.",
  unknownInvite: "Den här inbjudan finns inte.",
  couldNotOpenInvite:
    "Kunde inte öppna inbjudan. Kontrollera anslutningen och försök igen.",
  toYourFriends: "Till dina vänner",
  signInFailed: "Inloggningen misslyckades",
  tryAgainLater: "Försök igen om en stund.",
  whatsYourName: "Vad heter du?",
  friendsSeeYourName: "Dina vänner ser ditt namn.",
  name: "Namn",
  continue: "Fortsätt",
  signInToShare: "Logga in för att dela med vänner",
  signInWhy: "Dina vänner ser var du sitter, och du ser var de sitter.",
  signInWithGoogle: "Logga in med Google",
  devSignIn: "Utveckling: logga in med namn",
  sitsInSalenUntil: (time) => `Sitter i Salen · delar till ${time}`,
  notSharing: "Delar inte sin plats just nu",
  signInForFriends: "Logga in för att lägga till vänner och se var de sitter.",
  somethingWentWrong: "Något gick fel",
  inviteMessage: (url) =>
    `Bli vän med mig på Hvor, så ser vi var vi sitter: ${url}`,
  removeFriend: (name) => `Ta bort ${name}?`,
  removeFriendBody: "Ni slutar se varandras platser.",
  remove: "Ta bort",
  deleteAccountTitle: "Radera kontot?",
  deleteAccountBody:
    "Dina vänner och platserna du har delat raderas. Det går inte att ångra.",
  delete: "Radera",
  couldNotDelete: "Kunde inte radera",
  inviteFriend: "Bjud in en vän",
  wantsToBeFriends: "Vill bli vän med dig",
  accept: "Godkänn",
  decline: "Avböj",
  noFriendsYet: "Inga vänner än. Skicka din inbjudningslänk till någon.",
  awaitingReply: "Väntar på svar",
  withdraw: "Dra tillbaka",
  signedInAs: (name) => `Inloggad som ${name}`,
  signOut: "Logga ut",
  deleteAccount: "Radera konto",
};

const da: Strings = {
  locale: "da-DK",
  friends: "Venner",
  signIn: "Log ind",
  invitation: "Invitation",
  shareSeatWithFriends: "Del pladsen med venner",
  shareLocation: "Del placering",
  shareWithFriendsTitle: "Del med dine venner",
  shareForHowLong: "Hvor længe skal de se din plads?",
  hours: (n) => (n === 1 ? "1 time" : `${n} timer`),
  cancel: "Annuller",
  sharedWithFriends: "Delt med dine venner",
  theySeeYourSeatUntil: (time) => `De kan se din plads til ${time}.`,
  stopSharing: "Stop deling",
  couldNotStopSharing: "Kunne ikke stoppe deling",
  couldNotShare: "Kunne ikke dele",
  checkNetwork: "Tjek forbindelsen, og prøv igen.",
  sitsHere: (name) => `${name} sidder her`,
  shareTitle: "Her sidder jeg!",
  bannerHeadline: "Hvor sidder du?",
  bannerBody: "Vis dine venner din plads — hvor.app",
  iSitHere: "Her sidder jeg",
  invalidLocation: "Ugyldig placering",
  invalidLocationBody: "Dette link peger ikke på en gyldig placering.",
  requestSent: (name) =>
    `Anmodning sendt til ${name}. Du ser deres plads, når de accepterer.`,
  nowFriends: (name) => `Du og ${name} er nu venner.`,
  alreadyFriends: (name) => `Du og ${name} er allerede venner.`,
  ownInvite: "Dette er dit eget invitationslink. Send det til dine venner.",
  unknownInvite: "Denne invitation findes ikke.",
  couldNotOpenInvite:
    "Kunne ikke åbne invitationen. Tjek forbindelsen, og prøv igen.",
  toYourFriends: "Til dine venner",
  signInFailed: "Login mislykkedes",
  tryAgainLater: "Prøv igen om lidt.",
  whatsYourName: "Hvad hedder du?",
  friendsSeeYourName: "Dine venner kan se dit navn.",
  name: "Navn",
  continue: "Fortsæt",
  signInToShare: "Log ind for at dele med venner",
  signInWhy: "Dine venner ser, hvor du sidder, og du ser, hvor de sidder.",
  signInWithGoogle: "Log ind med Google",
  devSignIn: "Udvikling: log ind med navn",
  sitsInSalenUntil: (time) => `Sidder i Salen · deler til ${time}`,
  notSharing: "Deler ikke sin plads lige nu",
  signInForFriends: "Log ind for at tilføje venner og se, hvor de sidder.",
  somethingWentWrong: "Noget gik galt",
  inviteMessage: (url) =>
    `Bliv ven med mig på Hvor, så kan vi se, hvor hinanden sidder: ${url}`,
  removeFriend: (name) => `Fjern ${name}?`,
  removeFriendBody: "I holder op med at se hinandens pladser.",
  remove: "Fjern",
  deleteAccountTitle: "Slet kontoen?",
  deleteAccountBody:
    "Dine venner og de pladser, du har delt, bliver slettet. Det kan ikke fortrydes.",
  delete: "Slet",
  couldNotDelete: "Kunne ikke slette",
  inviteFriend: "Inviter en ven",
  wantsToBeFriends: "Vil være venner med dig",
  accept: "Accepter",
  decline: "Afvis",
  noFriendsYet: "Ingen venner endnu. Send dit invitationslink til nogen.",
  awaitingReply: "Venter på svar",
  withdraw: "Træk tilbage",
  signedInAs: (name) => `Logget ind som ${name}`,
  signOut: "Log ud",
  deleteAccount: "Slet konto",
};

const de: Strings = {
  locale: "de-DE",
  friends: "Freunde",
  signIn: "Anmelden",
  invitation: "Einladung",
  shareSeatWithFriends: "Platz mit Freunden teilen",
  shareLocation: "Standort teilen",
  shareWithFriendsTitle: "Mit deinen Freunden teilen",
  shareForHowLong: "Wie lange sollen sie deinen Platz sehen?",
  hours: (n) => (n === 1 ? "1 Stunde" : `${n} Stunden`),
  cancel: "Abbrechen",
  sharedWithFriends: "Mit deinen Freunden geteilt",
  theySeeYourSeatUntil: (time) => `Sie sehen deinen Platz bis ${time}.`,
  stopSharing: "Nicht mehr teilen",
  couldNotStopSharing: "Teilen konnte nicht beendet werden",
  couldNotShare: "Teilen fehlgeschlagen",
  checkNetwork: "Prüfe deine Verbindung und versuche es erneut.",
  sitsHere: (name) => `${name} sitzt hier`,
  shareTitle: "Hier sitze ich!",
  bannerHeadline: "Wo sitzt du?",
  bannerBody: "Zeig deinen Freunden deinen Platz — hvor.app",
  iSitHere: "Hier sitze ich",
  invalidLocation: "Ungültiger Standort",
  invalidLocationBody: "Dieser Link führt zu keinem gültigen Standort.",
  requestSent: (name) =>
    `Anfrage an ${name} gesendet. Du siehst den Platz, sobald die Anfrage angenommen wird.`,
  nowFriends: (name) => `Du und ${name} seid jetzt Freunde.`,
  alreadyFriends: (name) => `Du und ${name} seid schon Freunde.`,
  ownInvite:
    "Das ist dein eigener Einladungslink. Schick ihn an deine Freunde.",
  unknownInvite: "Diese Einladung gibt es nicht.",
  couldNotOpenInvite:
    "Die Einladung konnte nicht geöffnet werden. Prüfe deine Verbindung und versuche es erneut.",
  toYourFriends: "Zu deinen Freunden",
  signInFailed: "Anmeldung fehlgeschlagen",
  tryAgainLater: "Versuche es gleich noch einmal.",
  whatsYourName: "Wie heißt du?",
  friendsSeeYourName: "Deine Freunde sehen deinen Namen.",
  name: "Name",
  continue: "Weiter",
  signInToShare: "Melde dich an, um mit Freunden zu teilen",
  signInWhy: "Deine Freunde sehen, wo du sitzt, und du siehst, wo sie sitzen.",
  signInWithGoogle: "Mit Google anmelden",
  devSignIn: "Entwicklung: mit Namen anmelden",
  sitsInSalenUntil: (time) => `Sitzt in Salen · teilt bis ${time}`,
  notSharing: "Teilt den Platz gerade nicht",
  signInForFriends:
    "Melde dich an, um Freunde hinzuzufügen und zu sehen, wo sie sitzen.",
  somethingWentWrong: "Etwas ist schiefgelaufen",
  inviteMessage: (url) =>
    `Lass uns auf Hvor befreundet sein, dann sehen wir, wo wir sitzen: ${url}`,
  removeFriend: (name) => `${name} entfernen?`,
  removeFriendBody: "Ihr seht dann eure Plätze nicht mehr.",
  remove: "Entfernen",
  deleteAccountTitle: "Konto löschen?",
  deleteAccountBody:
    "Deine Freunde und die geteilten Plätze werden gelöscht. Das kann nicht rückgängig gemacht werden.",
  delete: "Löschen",
  couldNotDelete: "Löschen fehlgeschlagen",
  inviteFriend: "Freund einladen",
  wantsToBeFriends: "Möchten mit dir befreundet sein",
  accept: "Annehmen",
  decline: "Ablehnen",
  noFriendsYet: "Noch keine Freunde. Schick deinen Einladungslink an jemanden.",
  awaitingReply: "Warten auf Antwort",
  withdraw: "Zurückziehen",
  signedInAs: (name) => `Angemeldet als ${name}`,
  signOut: "Abmelden",
  deleteAccount: "Konto löschen",
};

const LANGUAGES: Record<string, Strings> = {
  nb,
  // Norwegian in any of its codes.
  no: nb,
  nn: nb,
  en,
  sv,
  da,
  de,
};

/**
 * The phone's languages, most preferred first. iOS's are read from the
 * user's settings: the locale iOS reports is held to the app's own
 * localisations, which it declares none of.
 */
function preferredLanguages(): string[] {
  if (Platform.OS === "ios") {
    const languages = Settings.get("AppleLanguages");
    if (Array.isArray(languages)) return languages;
  }
  return [I18nManager.getConstants().localeIdentifier ?? ""];
}

function pick(): Strings {
  for (const tag of preferredLanguages()) {
    const strings = LANGUAGES[tag.split(/[-_]/)[0].toLowerCase()];
    if (strings) return strings;
  }
  return nb;
}

/** The app's words in the phone's language, or Norwegian. */
export const t: Strings = pick();

/** A time of day, as `14:30`, in the app's language. */
export const time = (iso: string) =>
  new Date(iso).toLocaleTimeString(t.locale, {
    hour: "2-digit",
    minute: "2-digit",
  });

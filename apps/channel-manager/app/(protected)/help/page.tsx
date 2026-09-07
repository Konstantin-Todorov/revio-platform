import { HelpCentre } from "@revio/ui/help-centre";

/**
 * Help lives behind the login, on purpose.
 *
 * The answers name real screens in this product and assume the reader is signed in. A public help
 * site would have to hedge every one of them into uselessness, and nobody arrives here without an
 * account anyway.
 */
export default function HelpPage() {
  return <HelpCentre product="cm" productName="RevioLink" />;
}

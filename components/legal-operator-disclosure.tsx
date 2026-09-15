import { getLegalOperatorIdentity } from "@/lib/legal-release";

export function LegalOperatorDisclosure() {
  const identity = getLegalOperatorIdentity();

  if (!identity) {
    return <>
      <h2>Legal operator</h2>
      <p>Pulsercuit remains in controlled pre-launch while its formal operator identity and jurisdiction-specific legal contact details are being finalized. This page must not be treated as launch-complete until that identity is published.</p>
    </>;
  }

  return <>
    <h2>Legal operator</h2>
    <p><strong>{identity.name}</strong> operates Pulsercuit from {identity.jurisdiction}. Formal contact address: {identity.address}.</p>
    {identity.registrationId ? <p>Registration or legal identifier: {identity.registrationId}.</p> : null}
    <p>Legal notices: <a href={`mailto:${identity.legalContactEmail}`}>{identity.legalContactEmail}</a>. Privacy requests and data-protection matters: <a href={`mailto:${identity.privacyContactEmail}`}>{identity.privacyContactEmail}</a>.</p>
  </>;
}

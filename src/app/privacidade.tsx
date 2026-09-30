import React from "react";
import LegalScreen from "../components/LegalScreen";
import { PRIVACY } from "../lib/legal/termsPrivacy";

export default function Page() {
  return <LegalScreen doc={PRIVACY} />;
}
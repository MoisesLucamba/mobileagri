import React from "react";
import LegalScreen from "../components/LegalScreen";
import { TERMS } from "../lib/legal/termsPrivacy";

export default function Page() {
  return <LegalScreen doc={TERMS} />;
}
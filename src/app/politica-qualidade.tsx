import React from "react";
import LegalScreen from "../components/LegalScreen";
import { QUALITY } from "../lib/legal/policies";

export default function Page() {
  return <LegalScreen doc={QUALITY} />;
}
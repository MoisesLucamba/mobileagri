import React from "react";
import LegalScreen from "../components/LegalScreen";
import { COOKIES } from "../lib/legal/policies";

export default function Page() {
  return <LegalScreen doc={COOKIES} />;
}
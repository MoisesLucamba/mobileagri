import React from "react";
import LegalScreen from "../components/LegalScreen";
import { ACCEPTABLE_USE } from "../lib/legal/policies";

export default function Page() {
  return <LegalScreen doc={ACCEPTABLE_USE} />;
}
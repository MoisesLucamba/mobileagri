import React from "react";
import LegalScreen from "../components/LegalScreen";
import { ORDERS } from "../lib/legal/policies";

export default function Page() {
  return <LegalScreen doc={ORDERS} />;
}
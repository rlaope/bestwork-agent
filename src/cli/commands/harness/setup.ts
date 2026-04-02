import React from "react";
import { render } from "ink";
import { SetupWizard } from "../../../ui/SetupWizard.js";

export async function setupCommand() {
  render(React.createElement(SetupWizard));
}

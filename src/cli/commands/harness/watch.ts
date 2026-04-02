import React from "react";
import { render } from "ink";
import { WatchSetup } from "../../../ui/WatchSetup.js";

export async function watchCommand() {
  render(React.createElement(WatchSetup));
}

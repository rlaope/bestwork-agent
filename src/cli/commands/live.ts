import React from "react";
import { render } from "ink";
import { App } from "../../ui/App.js";

export async function liveCommand() {
  render(React.createElement(App, { watchMode: true }));
}

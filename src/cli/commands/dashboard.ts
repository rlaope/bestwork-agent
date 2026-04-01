import React from "react";
import { render } from "ink";
import { App } from "../../ui/App.js";

export async function dashboardCommand() {
  render(React.createElement(App));
}

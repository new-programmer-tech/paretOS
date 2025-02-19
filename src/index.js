import React, { lazy, Suspense } from "react";
import ReactDOM from "react-dom";
import Amplify from "@aws-amplify/core";
import API from "@aws-amplify/api";
import Storage from "@aws-amplify/storage";
import { I18n } from "@aws-amplify/core";
import { BrowserRouter as Router } from "react-router-dom";
import App from "./App";
import * as serviceWorkerRegistration from "./serviceWorkerRegistration";
import reportWebVitals from "./reportWebVitals";
import awsmobile from "./aws-exports";
import { Provider } from "react-redux";
import { createStore } from "redux";
import reducer from "./state/index";
import "./index.css";
import * as Sentry from "@sentry/react";
import { Integrations } from "@sentry/tracing";

Sentry.init({
  dsn: process.env.REACT_APP_SENTRY_DSN,
  integrations: [new Integrations.BrowserTracing()],

  // Set tracesSampleRate to 1.0 to capture 100%
  // of transactions for performance monitoring.
  // We recommend adjusting this value in production
  tracesSampleRate: 1.0,
});

const store = createStore(reducer);

Amplify.configure(awsmobile);
API.configure({
  endpoints: [
    {
      name: "pareto",
      endpoint: process.env.REACT_APP_PARETO_ENDPOINT,
      region: process.env.REACT_APP_PARETO_ENDPOINT,
    },
    {
      name: "util",
      endpoint: process.env.REACT_APP_UTIL_ENDPOINT,
      region: process.env.REACT_APP_UTIL_ENDPOINT,
    },
  ],
});

Storage.configure({
  AWSS3: {
    bucket: process.env.REACT_APP_PHOTO_BUCKET,
  },
});

ReactDOM.render(
  <Suspense fallback={<p>Loading...</p>}>
    <Router>
      <Provider store={store}>
        <App />
      </Provider>
    </Router>
  </Suspense>,
  document.getElementById("root")
);

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://cra.link/PWA
// @TODO register service worker for full PWA, currently disabled while in alpha
serviceWorkerRegistration.unregister();

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();

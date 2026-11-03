// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// Na het inloggen kiest het team een profiel (Luke/Indy). In tests staat standaard
// het profiel van Luke klaar, zodat schermen direct laden.
beforeEach(() => {
  try {
    window.sessionStorage.setItem("msk:profiel", "luke");
  } catch (e) {
    /* geen sessionStorage */
  }
});

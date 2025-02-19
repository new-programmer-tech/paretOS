import React, { Component } from "react";
import Auth from "@aws-amplify/auth";
import { I18n } from "@aws-amplify/core";
import API from "@aws-amplify/api";
import { withRouter, NavLink } from "react-router-dom";
import Glyphicon from "react-bootstrap/lib/Glyphicon";
import DropdownButton from "react-bootstrap/lib/DropdownButton";
import MenuItem from "react-bootstrap/lib/MenuItem";
import Image from "react-bootstrap/lib/Image";
import Routes from "./Routes";
import Pomodoro from "./pomodoro/Pomodoro";
import white from "./assets/Pareto_Lockup-White.png";
import blue from "./assets/Pareto-Blue-01.png";
import red from "./assets/Pareto-Red-01.png";
import question from "./assets/help.png";
import { errorToast } from "./libs/toasts";
import { bindActionCreators } from "redux";
import { connect } from "react-redux";
import {
  getActiveSprintData,
  getInitialSprintData,
  putUpdatedSprintData,
} from "./state/sprints";
import Tour from "reactour";
import "toasted-notes/src/styles.css";
import Dialog from "@material-ui/core/Dialog";
import LoadingModal from "./components/LoadingModal";
import sanity from "./libs/sanity";
import Slide from "@material-ui/core/Slide";
import BottomNav from "./components/BottomNav";
import { AiFillCode } from "react-icons/ai";
import { FaTools } from "react-icons/fa";
import { IoMdSchool } from "react-icons/io";
import ReconnectingWebSocket from "reconnecting-websocket";
import { strings } from "./libs/strings";
import { GrLogout } from "react-icons/gr";
import * as Sentry from "@sentry/react";
import sortby from "lodash.sortby";

const Transition = React.forwardRef(function Transition(props, ref) {
  return <Slide direction="up" ref={ref} {...props} />;
});

/**
 * This is the initial mount of the application, at the least the high level of it (index.js is the first load, excluding the index.html))
 * @TODO something is wrong with websocket connections, we are reconnecting too often. The pings are not working at establishing the consistent connection.
 * @TODO break down the file size, add some of these functions into the util.
 * @TODO review what childProps are necessary, and what are redundant. What do do about the redux/router props split?
 * @TODO review localization bug, where not everything is being changed on re-render.
 */

class App extends Component {
  constructor(props) {
    super(props);

    this.state = {
      isAuthenticated: false,
      isAuthenticating: true,
      showLoadingModal: true,
      username: "",
      user: { id: "8020", fName: "Vilfredo", lName: "Pareto" },
      training: {},
      product: {},
      interviewing: {},
      sprints: [],
      sprint: {},
      session: {},
      athletes: [],
      coaches: [],
      // admin state
      users: [],
      relationships: [],
      isTourOpen: false,
      loading: false,
      sanitySchemas: {
        technicalSchemas: [],
        economicSchemas: [],
        hubSchemas: [],
      },
      ws: "",
      experiences: [],
      messages: [],
      chosenLanguage: {
        name: "Language",
        image:
          "https://cdn.countryflags.com/thumbs/united-states-of-america/flag-400.png",
      },
      sanityTraining: [],
      sanityProduct: [],
      sanityInterview: [],
    };
    this.wsClient = "";
  }

  // initial websocket timeout duration as a class variable
  timeout = 5000;

  closeTour = () => {
    this.setState({
      isTourOpen: false,
    });
  };

  async componentDidMount() {
    this.setLoading();

    I18n.putVocabularies(strings);

    try {
      await this.fetchSanitySchemas();

      const session = await Auth.currentSession();
      this.setState({
        username: session.idToken.payload.sub,
        session: session,
      });
      this.setState({ isAuthenticating: false });

      await this.initialFetch(session.idToken.payload.sub);
    } catch (e) {
      console.log(e);
      if (e === "No current user") {
        this.setCloseLoading();
      }
      if (e !== "No current user") {
        errorToast(e, this.state.user);
      }
      this.setState({ loading: false });
    }
    this.setState({ isAuthenticating: false });
  }

  initialFetch = async (username) => {
    try {
      const user = await API.get("pareto", `/users/${username}`);
      if (user.length > 0) {
        this.setState({ user: user[0] });
        if (user[0].defaultLanguage) {
          I18n.setLanguage(user[0].defaultLanguage);
        }

        // if (user[0].learningPurchase === true || user[0].instructor === true) {
        await this.fetchStarterKitExperience(user[0].id);
        await this.fetchStarterKitSanity();
        // }

        await this.fetchCoaches(user[0].id);
        if (user[0].instructor === true) {
          await this.fetchCoachingRoster(user[0].id);
        }

        await this.connectSocketToSprint();

        this.userHasAuthenticated(true);
        this.setCloseLoading();
      }
    } catch (e) {
      console.log(e.toString());
      if (e.toString() === "Error: Network Error") {
        console.log("Successfully identified network error");
      }
    }
  };

  fetchStarterKitSanity = async () => {
    try {
      let storedTrainingSanity = localStorage.getItem("trainingSanity");
      let storedProductSanity = localStorage.getItem("productSanity");
      let storedInterviewSanity = localStorage.getItem("interviewSanity");

      if (storedTrainingSanity === null) {
        const trainingData = await sanity.fetch(
          `*[_type == 'apprenticeExperienceSchema']`
        );
        const interviewData = await sanity.fetch(
          `*[_type == 'interviewSchema']`
        );
        const productData = await sanity.fetch(
          `*[_type == 'productExperienceSchema']`
        );

        let sortedTraining = sortby(trainingData, "priority");
        let sortedInterview = sortby(interviewData, "priority");
        let sortedProduct = sortby(productData, "priority");

        this.setState({
          sanityTraining: sortedTraining,
          sanityInterview: sortedInterview,
          sanityProduct: sortedProduct,
        });

        localStorage.setItem("trainingSanity", JSON.stringify(sortedTraining));
        localStorage.setItem("productSanity", JSON.stringify(sortedProduct));
        localStorage.setItem(
          "interviewSanity",
          JSON.stringify(sortedInterview)
        );
      } else {
        this.setState({
          sanityTraining: JSON.parse(storedTrainingSanity),
          sanityInterview: JSON.parse(storedInterviewSanity),
          sanityProduct: JSON.parse(storedProductSanity),
        });
      }
    } catch (e) {
      console.log("Error fetching Sanity Experience: ", e);
    }
  };

  fetchStarterKitExperience = async (id) => {
    try {
      let experiences = await API.get("pareto", `/experience/user/${id}`);
      let product;
      let apprenticeship;
      let interviewing;

      experiences.forEach((exp) => {
        if (exp.type === "Product") {
          product = exp;
        } else if (exp.type === "Apprenticeship") {
          apprenticeship = exp;
        } else if (exp.type === "Interviewing") {
          interviewing = exp;
        }
      });
      this.setState({
        training: apprenticeship,
        product: product,
        interviewing: interviewing,
        experiences: experiences,
      });
    } catch (e) {
      console.log("Error fetching experience: ", e);
    }
  };

  connectSocketToSprint = async () => {
    const sprints = await API.get(
      "pareto",
      `/sprints/mentee/${this.state.user.id}`
    );
    this.props.getInitialSprintData(sprints);
    this.setState({ sprints: sprints });

    if (sprints.length === 0) {
      return;
    }

    let sprintStrings = [];

    sprints.map((spr, idx) => {
      sprintStrings.push(`key${idx}=${spr.id}`);
    });

    let sprintString = sprintStrings.join("&");

    var wsClient = new ReconnectingWebSocket(
      `wss://2los2emuze.execute-api.us-east-1.amazonaws.com/Prod?${sprintString}`
    );

    let that = this; // caching 'this'
    var connectInterval;

    wsClient.onopen = () => {
      console.log("Connected");
      this.setState({ ws: wsClient });
      that.timeout = 250; // reset timer to 250 on open of websocket connection
      clearTimeout(connectInterval); //clear interval on onOpen of websocket connection

      setInterval(function () {
        wsClient.send(`{"action":"sendmessage", "data":"ping" }`);
      }, 400000);
    };

    wsClient.onmessage = (message) => {
      // console.log("Received data: ", JSON.parse(message.data));
      let tempSprintData = JSON.parse(message.data);
      let newerSprintArray = this.state.sprints.slice();
      let tempVar = 0;
      for (let i = 0; i < this.state.sprints.length; i++) {
        if (this.state.sprints[i].id === tempSprintData.id) {
          tempVar = i;
          break;
        }
      }
      newerSprintArray[tempVar] = tempSprintData;
      try {
        this.setState({ sprints: newerSprintArray });
        this.props.putUpdatedSprintData(newerSprintArray);
      } catch (e) {
        console.log("onmessage error", e);
      }
    };

    wsClient.onclose = (e) => {
      console.log(
        `Socket is closed. Reconnect will be attempted in ${Math.min(
          10000 / 1000,
          (that.timeout + that.timeout) / 1000
        )} second.`,
        e.reason
      );

      that.timeout = that.timeout + that.timeout; // increment retry interval
      connectInterval = setTimeout(this.check, Math.min(10000, that.timeout)); // call check function after timeout
    };

    wsClient.onerror = (err) => {
      console.log("Socket encountered error: ", err.message);
      console.log("Closing Socket");

      wsClient.close();
    };
  };

  check = () => {
    const { ws } = this.state;
    console.log("Websocket status: ", ws);
    if (
      !ws ||
      ws.readyState === WebSocket.CLOSED ||
      ws.readyState === WebSocket.CLOSING
    ) {
      this.connectSocketToSprint(); // check if ws instance is closed - if so, reconnect
    }
  };

  fetchSanitySchemas = async () => {
    try {
      let existingSanityData = localStorage.getItem("sanity");
      if (existingSanityData === null) {
        const query = `*[_type == 'project']`;
        const query1 = `*[_type == 'economic']`;
        const query2 = `*[_type == 'hubs' && !(_id in path("drafts.**"))]`;
        const projectSchemas = await sanity.fetch(query);
        const economicSchemas = await sanity.fetch(query1);
        const hubsSchemas = await sanity.fetch(query2);

        let sanitySchemas = {
          technicalSchemas: projectSchemas,
          economicSchemas: economicSchemas,
          hubSchemas: hubsSchemas,
        };
        this.setState({
          sanitySchemas: sanitySchemas,
        });
        localStorage.setItem("sanity", JSON.stringify(sanitySchemas));
      } else {
        this.setState({ sanitySchemas: JSON.parse(existingSanityData) });
      }
    } catch (e) {
      errorToast(e);
    }
  };

  fetchMenteeSprints = async (userId) => {
    try {
      let menteeSprints = await API.get("pareto", `/sprints/mentee/${userId}`);
      this.setState({ sprints: menteeSprints });
    } catch (e) {
      errorToast(e);
    }
  };

  fetchCoachingRoster = async (id) => {
    try {
      let athletes = await API.get("pareto", `/relationship/mentor/${id}`);
      this.setState({ athletes: athletes });
    } catch (e) {
      console.log("Error fetching athletes");
    }
  };

  fetchCoaches = async (id) => {
    try {
      let existingCoaches = localStorage.getItem("coaches");
      if (existingCoaches === null) {
        let coaches = await API.get("pareto", `/relationship/mentee/${id}`);
        this.setState({ coaches: coaches });
        localStorage.setItem("coaches", JSON.stringify(coaches));
      } else {
        // check for empty arrays
        this.setState({ coaches: JSON.parse(existingCoaches) });
      }
    } catch (e) {
      console.log("Error fetching athletes");
    }
  };

  userHasAuthenticated = (authenticated) => {
    this.setState({ isAuthenticated: authenticated });
  };

  refreshExperience = (type, updatedObject) => {
    if (type === "training") {
      this.setState({ training: updatedObject });
    } else if (type === "product") {
      this.setState({ product: updatedObject });
    } else if (type === "interviewing") {
      this.setState({ interviewing: updatedObject });
    }
  };

  handleLogout = async (event) => {
    event.preventDefault();
    await Auth.signOut();
    this.userHasAuthenticated(false);
    this.props.history.push("/login");
  };

  setLoading = () => {
    this.setState({ loading: true });
  };

  setCloseLoading = () => {
    this.setState({ loading: false });
  };

  renderLanguageDropdown() {
    return (
      <div style={{ marginLeft: 14 }}>
        <Image
          src={this.state.chosenLanguage.image}
          height="26"
          width="26"
          circle
        />
        <DropdownButton
          key={1}
          title={`${this.state.chosenLanguage.name}`}
          id={`pick-service`}
          style={{
            color: "white",
            fontSize: 14,
            backgroundColor: "rgb(37, 38, 39)",
            border: "none",
          }}
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          <div style={{ marginLeft: 4 }}>
            <MenuItem
              exact
              key={1.1}
              onClick={() => {
                I18n.setLanguage("lg");
                this.setState({
                  chosenLanguage: {
                    name: "Lugandan",
                    image:
                      "https://cdn.countryflags.com/thumbs/uganda/flag-square-250.png",
                  },
                });
              }}
            >
              <Glyphicon glyph="glyphicon glyphicon-cog" />
              &ensp; Luganda
            </MenuItem>
            <MenuItem
              exact
              key={1.2}
              onClick={() => {
                I18n.setLanguage("es");
                this.setState({
                  chosenLanguage: {
                    name: "Spanish",
                    image:
                      "https://cdn.countryflags.com/thumbs/spain/flag-400.png",
                  },
                });
              }}
            >
              <Glyphicon glyph="glyphicon glyphicon-cog" />
              &ensp; Spanish
            </MenuItem>
            <MenuItem
              exact
              key={1.3}
              onClick={() => {
                I18n.setLanguage("en");
                this.setState({
                  chosenLanguage: {
                    name: "English",
                    image:
                      "https://cdn.countryflags.com/thumbs/united-states-of-america/flag-400.png",
                  },
                });
              }}
            >
              <Glyphicon glyph="glyphicon glyphicon-cog" />
              &ensp; English
            </MenuItem>
          </div>
        </DropdownButton>
      </div>
    );
  }

  renderLeftNav() {
    let textStyle = {
      color: "rgb(79, 101, 116)",
      textDecoration: "none",
      fontSize: 20,
      marginLeft: 12,
      marginTop: 14,
    };
    let noPadStyle = {
      color: "rgb(79, 101, 116)",
      fontSize: 18,
      marginTop: 14,
      marginLeft: 26,
      display: "flex",
    };
    let activeTextStyle = {
      color: "rgb(243, 247, 249)",
      textDecoration: "none",
    };
    return (
      <div id="mySidenav" className="sidenav">
        <div style={{ marginLeft: 10, display: "flex" }}>
          <Image
            src={
              this.state.user.picture ||
              "https://wallsheaven.co.uk/photos/A065336811/220/user-account-profile-circle-flat-icon-for-apps-and-websites-.webp"
            }
            height="40"
            width="40"
            circle
          />
          <p
            style={{
              color: "white",
              fontSize: 18,
              backgroundColor: "rgb(37, 38, 39)",
              border: "none",
              marginTop: 6,
              marginLeft: 12,
            }}
          >
            {this.state.user.fName}
          </p>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          {this.renderLanguageDropdown()}
        </div>

        <div style={{}}>
          <NavLink
            to="/"
            style={textStyle}
            className="flex"
            activeStyle={activeTextStyle}
            exact
          >
            <img
              src={red}
              height="30"
              width="30"
              alt="pareto blue"
              className="first-step"
            />
            &ensp; <p style={{ marginTop: 4 }}>{I18n.get("arena")}</p>
          </NavLink>
        </div>

        {this.state.user.instructor === true &&
        this.state.athletes.length !== 0 ? (
          <React.Fragment>
            <p style={(activeTextStyle, { marginLeft: 12, marginTop: 10 })}>
              <img
                src={red}
                height="30"
                width="30"
                style={{ marginBottom: 6 }}
                alt="pareto-learn"
              />
              &ensp; {I18n.get("mentorship")}
            </p>

            {/* Experience/Quick Info Below */}
            <div className="small-overflow">
              {this.state.athletes.map((relationship, idx) => {
                return (
                  <NavLink to={`/mentorship/${relationship.id}`} key={idx}>
                    <div
                      className="flex"
                      style={{
                        fontSize: 16,
                        color: "white",
                        padding: 8,
                      }}
                    >
                      <p style={{ marginTop: 6, marginLeft: 18 }}>
                        {idx + 1}. {relationship.mentee.fName}{" "}
                        {relationship.mentee.lName}
                      </p>
                    </div>
                  </NavLink>
                );
              })}
            </div>
          </React.Fragment>
        ) : null}
        {this.state.user.instructor !== true ? (
          <div>
            {/* Experience/Quick Info Below */}
            <div style={{ marginTop: 15, marginLeft: 3 }}>
              <NavLink
                to="/training"
                style={textStyle}
                className="flex"
                activeStyle={activeTextStyle}
                exact
              >
                <img
                  src={blue}
                  height="30"
                  width="30"
                  alt="pareto blue"
                  className="first-step"
                />
                &ensp;{" "}
                <p style={{ marginTop: 4 }}>{I18n.get("basicTraining")}</p>
              </NavLink>
            </div>
            <div
              style={{
                // marginLeft: 22,
                fontSize: 14,
                color: "white",
              }}
              className="sixth-step-exp"
            >
              <NavLink
                to={`/training/${this.state.user.apprenticeshipId}`}
                style={noPadStyle}
                activeStyle={activeTextStyle}
                exact
              >
                <AiFillCode style={{ height: 26, width: 26 }} />
                <p style={{ marginLeft: 10 }}>
                  {I18n.get("technicalTraining")}
                </p>
              </NavLink>
              <NavLink
                to={`/training/${this.state.user.productId}`}
                style={noPadStyle}
                activeStyle={activeTextStyle}
                exact
              >
                <FaTools style={{ height: 26, width: 26 }} />
                <p style={{ marginLeft: 10 }}>{I18n.get("product")}</p>
              </NavLink>
              <NavLink
                to={`/training/${this.state.user.masteryId}`}
                style={noPadStyle}
                activeStyle={activeTextStyle}
                exact
              >
                <IoMdSchool style={{ height: 26, width: 26 }} />
                <p style={{ marginLeft: 10 }}>{I18n.get("interviewing")}</p>
              </NavLink>
            </div>
          </div>
        ) : null}

        <div style={{ flex: "0 0 4px" }} />

        <div style={{ flex: "0 0 4px" }} />

        <NavLink
          to="/context-builder"
          style={textStyle}
          activeStyle={activeTextStyle}
          className="third-step"
          exact
        >
          <img
            src={blue}
            height="30"
            width="30"
            alt="context-builder"
            style={{ marginBottom: 6 }}
          />
          &ensp;{I18n.get("library")}
        </NavLink>

        <div style={{ flex: "0 0 4px" }} />

        <div style={{ flex: "0 0 4px" }} />

        <NavLink
          to={`/profile/edit/${this.state.user.id}`}
          style={textStyle}
          activeStyle={activeTextStyle}
          exact
        >
          <img
            src={blue}
            height="30"
            width="30"
            alt="context-builder"
            style={{ marginBottom: 6 }}
          />
          &ensp;Edit Profile
        </NavLink>

        <div style={{ flex: "0 0 4px" }} />

        <div style={{ flex: "0 0 16px" }} />

        {/* <div className="fourth-step">
          <Pomodoro />
        </div> */}

        <div style={{ flex: "0 0 16px" }} />

        <img
          src={white}
          height="50"
          width="200"
          style={{ position: "fixed", bottom: 20, left: 15 }}
          alt="pareto logo"
        />
      </div>
    );
  }

  render() {
    const Onboarding = withRouter(({ location: { pathname }, history }) => {
      const steps = [
        {
          selector: ".first-step",
          content: `${I18n.get("appFirst")}`,
        },
        {
          selector: ".second-step",
          content: `${I18n.get("appSecond")}`,
        },
        {
          selector: ".third-step",
          content: `${I18n.get("appThird")}`,
        },
        // {
        //   selector: ".fourth-step",
        //   content: `${I18n.get("appFourth")}`,
        // },
        {
          selector: ".fifth-step",
          content: `${I18n.get("appFifth")}`,
        },
        {
          selector: ".sixth-step",
          content: `${I18n.get("appSixth")}`,
        },
      ];
      return (
        <Tour
          steps={steps}
          isOpen={this.state.isTourOpen}
          onRequestClose={this.closeTour}
          showCloseButton={true}
          update={pathname}
          rewindOnClose={false}
        />
      );
    });
    const childProps = {
      // authentication related state
      isAuthenticated: this.state.isAuthenticated,
      userHasAuthenticated: this.userHasAuthenticated,
      username: this.state.username,
      user: this.state.user,
      session: this.state.session,
      setLoading: this.setLoading,
      setCloseLoading: this.setCloseLoading,
      chosenLanguage: this.state.chosenLanguage,
      connectSocket: this.connectSocketToSprint,
      ws: this.state.ws,

      // experience related state
      product: this.state.product,
      interviewing: this.state.interviewing,
      training: this.state.training,
      refreshExperience: this.refreshExperience,
      sanityTraining: this.state.sanityTraining,
      sanityInterview: this.state.sanityInterview,
      sanityProduct: this.state.sanityProduct,
      experiences: this.state.experiences,

      // sprint related state
      fetchMenteeSprints: this.fetchMenteeSprints,
      initialFetch: this.initialFetch,
      sprints: this.state.sprints,
      messages: this.state.messages,

      // assorted/unused state
      users: this.state.users,
      relationships: this.state.relationships,
      athletes: this.state.athletes,
      sanitySchemas: this.state.sanitySchemas,
      coaches: this.state.coaches,
    };
    return (
      !this.state.isAuthenticating && (
        <Sentry.ErrorBoundary
          fallback={({ error, componentStack, resetError }) => (
            <React.Fragment>
              <div>
                Dear user, you have (sadly) encountered an error. The error is
                written out for you below, but it's probably useless to you. If
                you are just interested in moving past this unfortunate
                incident, click the button below to reload the page and start
                fresh.
              </div>
              <div>{error.toString()}</div>
              <div>{componentStack}</div>
              <button onClick={() => window.location.replace("/")}>
                Click here to reset!
              </button>
            </React.Fragment>
          )}
        >
          <React.Fragment>
            {this.state.isAuthenticated ? (
              <React.Fragment>
                <div className="sticky-logout" onClick={this.handleLogout}>
                  <GrLogout />
                </div>

                <div className="root-padding">
                  {this.renderLeftNav()}

                  <Routes childProps={childProps} />
                </div>
                <div className="sticky-nav">
                  <div className="sticky-chat">
                    <Image
                      src={question}
                      onClick={(event) => {
                        event.preventDefault();
                        this.setState({ isTourOpen: true });
                      }}
                      height="65"
                      width="65"
                      circle
                      className="sticky-btn"
                      style={{ marginRight: 12, cursor: "pointer" }}
                    />
                  </div>
                  <div id="myBottomNav" className="bottom-nav">
                    <BottomNav user={this.state.user} />
                  </div>
                </div>
              </React.Fragment>
            ) : (
              <Routes childProps={childProps} />
            )}
            <Onboarding
              isOpen={this.state.isTourOpen}
              onRequestClose={this.closeTour}
              showCloseButton={true}
            />
            <Dialog
              style={{
                margin: "auto",
              }}
              open={this.state.loading}
              TransitionComponent={Transition}
              keepMounted
              disableEscapeKeyDown={true}
              fullScreen={true}
              fullWidth={true}
              disableBackdropClick={true}
              hideBackdrop={false}
              aria-labelledby="loading"
              aria-describedby="Please wait while the page loads"
            >
              <LoadingModal />
            </Dialog>
          </React.Fragment>
        </Sentry.ErrorBoundary>
      )
    );
  }
}

const mapStateToProps = (state) => {
  return {
    redux: state.redux,
  };
};

const mapDispatchToProps = (dispatch) => {
  return bindActionCreators(
    {
      getActiveSprintData: (data) => getActiveSprintData(data),
      getInitialSprintData: (data) => getInitialSprintData(data),
      putUpdatedSprintData: (data) => putUpdatedSprintData(data),
    },
    dispatch
  );
};

export default connect(mapStateToProps, mapDispatchToProps)(withRouter(App));

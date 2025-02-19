import React, { Component } from "react";
import DialogContent from "@material-ui/core/DialogContent";
import DialogContentText from "@material-ui/core/DialogContentText";
import { DialogActions } from "@material-ui/core";
import FormGroup from "react-bootstrap/lib/FormGroup";
import ControlLabel from "react-bootstrap/lib/ControlLabel";
import FormControl from "react-bootstrap/lib/FormControl";
import Button from "react-bootstrap/lib/Button";
import LoaderButton from "../components/LoaderButton";
import { errorToast, successToast } from "../libs/toasts";
import { generateEmail } from "../libs/errorEmail";
import { API } from "@aws-amplify/api";

/**
 * This is the modal where folks can offer suggestions into the prod knowledge base.
 * @TODO Review UI
 */

export default class SuggestionModal extends Component {
  constructor(props) {
    super(props);

    this.state = {
      title: "",
      description: "",
      url: "",
      imgUrl: "",
      type: "article",
      submissionLoading: false,
    };
  }

  handleChange = (event) => {
    this.setState({
      [event.target.id]: event.target.value,
    });
  };

  validateForm() {
    return (
      this.state.title.length > 0 &&
      this.state.description.length > 0 &&
      this.state.url.length > 0 &&
      this.state.type.length > 0
    );
  }

  handleSubmit = async (event) => {
    event.preventDefault();
    this.setState({ submissionLoading: true });
    const mutations = [
      {
        create: {
          _type: `${this.props.schema}Schema`,
          title: this.state.title,
          summary: this.state.description,
          url: this.state.url,
          type: this.state.type,
        },
      },
    ];

    let messageTitle = `${this.props.schema} suggestion received`;
    let messageDescription = `${this.props.user.fName} ${this.props.user.lName} has submitted a resource with the title ${this.state.title}. Please review it on the Sanity Creation Studio.`;

    let email = generateEmail(messageTitle, messageDescription);

    try {
      fetch(
        `https://${process.env.REACT_APP_SANITY_ID}.api.sanity.io/v1/data/mutate/production`,
        {
          method: "post",
          headers: {
            "Content-type": "application/json",
            Authorization: `Bearer ${process.env.REACT_APP_SANITY_TOKEN}`,
          },
          body: JSON.stringify({ mutations }),
        }
      )
        .then((response) => response.json())
        // .then((result) => console.log(result))
        .catch((error) => console.error(error));

      await API.post("util", "/email", {
        body: {
          recipient: "michael@pareto.education",
          sender: "michael@pareto.education",
          subject: messageTitle,
          htmlBody: email,
          textBody: messageDescription,
        },
      });

      this.setState({ submissionLoading: false });
      this.props.handleClose();
      successToast("Thank you for your suggestion!");
    } catch (e) {
      errorToast(e);
      this.setState({ submissionLoading: false });
    }
  };

  render() {
    return (
      <div>
        <h1>Suggestion for {this.props.schema}</h1>
        <DialogContent>
          <DialogContentText>
            Please include the link to the resource, a proposed title,
            description and link to logo/image associated with the suggestion.
          </DialogContentText>
          <FormGroup controlId="title" bsSize="large">
            <ControlLabel>Title</ControlLabel>
            <FormControl
              value={this.state.title}
              onChange={this.handleChange}
            />
          </FormGroup>
          <FormGroup controlId="description" bsSize="large">
            <ControlLabel>Description</ControlLabel>
            <FormControl
              value={this.state.description}
              onChange={this.handleChange}
            />
          </FormGroup>
          <FormGroup controlId="url" bsSize="large">
            <ControlLabel>Website Link</ControlLabel>
            <FormControl value={this.state.url} onChange={this.handleChange} />
          </FormGroup>
          <FormGroup controlId="type" bsSize="large">
            <ControlLabel>Type</ControlLabel>
            <FormControl
              componentClass="select"
              onChange={this.handleChange}
              value={this.state.type}
            >
              <option value="jobs">Jobs</option>
              <option value="modules">Libraries / SDKs / Modules</option>
              <option value="news">News, Trends and Valuable Info</option>
              <option value="community">Meetups / Communities</option>
              <option value="education">Educational Programs</option>
              <option value="companies">Amazing Companies</option>
              <option value="incubators">Startup Incubators</option>
              <option value="vc">Venture Capital</option>
              <option value="docs">Documentation</option>
              <option value="game">Games / Gamified Resources</option>
              <option value="marketplace">Marketplace</option>
              <option value="tutorial">Tutorial</option>
              <option value="article">Article</option>
              <option value="audio">Podcast / Audiobook</option>
              <option value="video">Video</option>
              <option value="social">Social Network</option>
              <option value="book">Book</option>
            </FormControl>
          </FormGroup>

          <FormGroup controlId="imgUrl" bsSize="large">
            <ControlLabel>Link to Logo/Image (optional)</ControlLabel>
            <FormControl
              value={this.state.imgUrl}
              onChange={this.handleChange}
            />
          </FormGroup>
        </DialogContent>

        <DialogActions>
          <Button onClick={this.props.handleClose}>Cancel</Button>
          <LoaderButton
            text="Submit Suggestion"
            loadingText="Submitting"
            disabled={!this.validateForm()}
            isLoading={this.state.submissionLoading}
            onClick={this.handleSubmit}
          />
        </DialogActions>
      </div>
    );
  }
}

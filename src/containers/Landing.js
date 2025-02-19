import React, { useState } from "react";
import { Link } from "react-router-dom";
import logo from "../assets/Pareto_Lockup-White.png";
import { I18n } from "@aws-amplify/core";
import Button from "react-bootstrap/lib/Button";
import marketing from "../assets/marketing.png";
import jerod from "../assets/jerod.jpeg";
import deline from "../assets/deline.jpeg";

/**
 * This is the Landing page component, that has the testimonials from theoretically real users.
 * @TODO need to actually have some testimonials. Instead of their images, I need to put their photos in a public S3 bucket and fetch them to keep bundle sizes down.
 * @TODO foreign language testimonials? Depending on IP address? Or Lambda @ Edge? This is far away from now.
 * @TODO add a signup button back in, once that process is verified working again.
 */

function Landing(props) {
  const [testimonials, setTestimonials] = useState([]);
  return (
    <div>
      <div className="top-nav">
        <img
          src={logo}
          alt="Pareto"
          height="40"
          width="178"
          style={{ marginTop: 10, marginLeft: 12 }}
        />
        <Link
          to="/login"
          style={{ color: "white", marginTop: 18, marginRight: 18 }}
        >
          {I18n.get("login")}
        </Link>
      </div>
      <div style={{ marginTop: 65, paddingLeft: 40, paddingRight: 40 }}>
        <h1 className="text-center">{I18n.get("firstLanding")}</h1>
        <p className="text-center">{I18n.get("secondLanding")}</p>
        <p className="text-center">{I18n.get("thirdLanding")}</p>
        <br />
        {/* <div style={{ textAlign: 'center' }}>
					<Button onClick={() => props.history.push('/signup')}>{I18n.get('signup')}</Button>
				</div> */}
        <br />
        <div className="flex-center">
          <img
            src={marketing}
            style={{ width: "100%", height: "auto" }}
            alt="Screenshot of the learning system"
          />
        </div>
        <br />
        <br />
        {/* <h2 className="text-center">{I18n.get("landingText")}</h2> */}
        <div className="context-cards">
          {testimonials.map((test, i) => {
            return (
              <div className="context-card" key={i}>
                <p className="text-center" style={{ fontWeight: "bold" }}>
                  {test.words}
                </p>
                <div style={{ width: "100%", textAlign: "center" }}>
                  <img
                    src={test.img}
                    height="60"
                    width="60"
                    alt={test.name}
                    style={{ borderRadius: "50%" }}
                  />
                </div>
                <h3
                  className="text-center"
                  style={{ color: "rgb(37, 38, 39)", fontWeight: "bolder" }}
                >
                  {test.name}
                </h3>
                <p className="text-center" style={{ color: "rgb(37, 38, 39)" }}>
                  {test.title}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default Landing;

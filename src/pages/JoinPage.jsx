import { useState } from "react";
import emailjs from "@emailjs/browser";
import RouteLoading from "../components/RouteLoading";
import { usePortalPage } from "../hooks/usePortalPage";
import { useTrackVisit } from "../hooks/useTrackVisit";
import { supabase } from "../lib/supabase";
import {
  EMAILJS_SERVICE_ID,
  EMAILJS_INTEREST_TEMPLATE_ID,
  EMAILJS_PUBLIC_KEY,
  emailjsConfigured
} from "../config/emailjs";

const NOTIFY_EMAIL = "viswanathv2@gmail.com";

const emptyJoin = {
  full_name: "",
  grade: "",
  email: "",
  phone: "",
  intro: "",
  heard_about: "",
  acknowledged: false
};

const emptyOnboard = {
  full_name: "",
  email: "",
  phone: "",
  team_location: "",
  student_count: "",
  needs_member_support: "",
  needs_onboarding_help: "",
  additional_info: ""
};

export default function JoinPage() {
  const page = usePortalPage("join");
  useTrackVisit("join");

  const [choice, setChoice] = useState(""); // "" | "join" | "onboard"
  const [join, setJoin] = useState(emptyJoin);
  const [onboard, setOnboard] = useState(emptyOnboard);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  function reset() {
    setChoice("");
    setJoin(emptyJoin);
    setOnboard(emptyOnboard);
    setSubmitted(false);
    setError("");
  }

  // Notify the team by email. Uses EmailJS when configured, otherwise opens
  // the visitor's mail app addressed to the team inbox as a fallback.
  async function notifyTeam(subject, lines) {
    const body = lines.join("\n");
    if (emailjsConfigured) {
      try {
        await emailjs.send(
          EMAILJS_SERVICE_ID,
          EMAILJS_INTEREST_TEMPLATE_ID,
          {
            to_email: NOTIFY_EMAIL,
            subject,
            from_name: "FTC Interest Form",
            message: body
          },
          { publicKey: EMAILJS_PUBLIC_KEY }
        );
        return;
      } catch {
        // fall through to mailto
      }
    }
    const mailto = `mailto:${NOTIFY_EMAIL}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;
    window.open(mailto, "_blank");
  }

  async function submitJoin(event) {
    event.preventDefault();
    setError("");

    if (!join.full_name.trim()) {
      setError("Please enter your full name.");
      return;
    }
    if (!join.email.trim() && !join.phone.trim()) {
      setError("Please provide a phone number or an email address so we can reach you.");
      return;
    }
    if (!join.acknowledged) {
      setError("Please acknowledge the time commitment and participation requirements.");
      return;
    }

    setSubmitting(true);
    const { error: insertError } = await supabase.from("interest_submissions").insert({
      kind: "join",
      full_name: join.full_name.trim(),
      grade: join.grade.trim() || null,
      email: join.email.trim() || null,
      phone: join.phone.trim() || null,
      intro: join.intro.trim() || null,
      heard_about: join.heard_about.trim() || null,
      acknowledged: true,
      status: "New",
      created_at: new Date().toISOString()
    });

    if (insertError) {
      setSubmitting(false);
      setError(`Sorry, we couldn't submit your form: ${insertError.message}`);
      return;
    }

    await notifyTeam(`New FTC join request from ${join.full_name.trim()}`, [
      "A new request to JOIN an FTC team was submitted.",
      "",
      `Full name: ${join.full_name.trim()}`,
      `Grade: ${join.grade.trim() || "—"}`,
      `Email: ${join.email.trim() || "—"}`,
      `Phone: ${join.phone.trim() || "—"}`,
      `How they heard about us: ${join.heard_about.trim() || "—"}`,
      "",
      "Introduction:",
      join.intro.trim() || "(none)"
    ]);

    setSubmitting(false);
    setSubmitted(true);
  }

  async function submitOnboard(event) {
    event.preventDefault();
    setError("");

    if (!onboard.full_name.trim()) {
      setError("Please enter your name.");
      return;
    }
    if (!onboard.email.trim() && !onboard.phone.trim()) {
      setError("Please provide a phone number or an email address so we can reach you.");
      return;
    }
    if (!onboard.team_location.trim()) {
      setError("Please share the team location so we can follow up.");
      return;
    }

    setSubmitting(true);
    const { error: insertError } = await supabase.from("interest_submissions").insert({
      kind: "onboard",
      full_name: onboard.full_name.trim(),
      email: onboard.email.trim() || null,
      phone: onboard.phone.trim() || null,
      team_location: onboard.team_location.trim(),
      student_count: onboard.student_count.trim() || null,
      needs_member_support: onboard.needs_member_support || null,
      needs_onboarding_help: onboard.needs_onboarding_help || null,
      additional_info: onboard.additional_info.trim() || null,
      status: "New",
      created_at: new Date().toISOString()
    });

    if (insertError) {
      setSubmitting(false);
      setError(`Sorry, we couldn't submit your request: ${insertError.message}`);
      return;
    }

    await notifyTeam(`New FTC team onboarding request (${onboard.team_location.trim()})`, [
      "A new request to START / ONBOARD a new FTC team was submitted.",
      "",
      `Name: ${onboard.full_name.trim()}`,
      `Email: ${onboard.email.trim() || "—"}`,
      `Phone: ${onboard.phone.trim() || "—"}`,
      `Team location: ${onboard.team_location.trim()}`,
      `Students already identified: ${onboard.student_count.trim() || "—"}`,
      `Needs help identifying members: ${onboard.needs_member_support || "—"}`,
      `Needs onboarding / next-steps help: ${onboard.needs_onboarding_help || "—"}`,
      "",
      "Additional information:",
      onboard.additional_info.trim() || "(none)"
    ]);

    setSubmitting(false);
    setSubmitted(true);
  }

  if (page.loading) {
    return <RouteLoading />;
  }

  return (
    <section className="landing-page">
      <header className="landing-header">
        <h1>{page.title || "FTC Team Interest Form"}</h1>
        <p className="landing-tagline">
          {page.subtitle ||
            "Thank you for your interest in the FTC team. Please choose the option below that best matches your current need."}
        </p>
      </header>

      <div className="landing-container">
        <section className="landing-section sponsorship-section">
          {submitted ? (
            <div className="sponsor-form-card">
              <div className="sponsor-success">
                <h3>Thank you!</h3>
                <p>
                  Your form has been submitted. The team will review your information and follow up
                  with next steps.
                </p>
                <button type="button" className="sponsor-link-btn" onClick={reset}>
                  Submit another response
                </button>
              </div>
            </div>
          ) : !choice ? (
            <div className="interest-choice">
              <button
                type="button"
                className="download-btn interest-choice-btn"
                onClick={() => setChoice("join")}
              >
                I&apos;m interested in joining an FTC team
              </button>
              <button
                type="button"
                className="download-btn interest-choice-btn"
                onClick={() => setChoice("onboard")}
              >
                I&apos;m starting or onboarding a new FTC team
              </button>
              <p className="interest-footer-note">
                After you submit the form, the team will review your information and follow up with
                next steps.
              </p>
            </div>
          ) : choice === "join" ? (
            <div className="sponsor-form-card">
              <form className="sponsor-form" onSubmit={submitJoin}>
                <div className="sponsor-form-title">Tell us about yourself</div>

                <label className="sponsor-label" htmlFor="joinName">Full Name</label>
                <input
                  id="joinName"
                  type="text"
                  required
                  value={join.full_name}
                  onChange={(e) => setJoin((v) => ({ ...v, full_name: e.target.value }))}
                  placeholder="Your full name"
                />

                <label className="sponsor-label" htmlFor="joinGrade">Grade</label>
                <input
                  id="joinGrade"
                  type="text"
                  value={join.grade}
                  onChange={(e) => setJoin((v) => ({ ...v, grade: e.target.value }))}
                  placeholder="e.g. 7th grade"
                />

                <label className="sponsor-label" htmlFor="joinEmail">Email Address</label>
                <input
                  id="joinEmail"
                  type="email"
                  value={join.email}
                  onChange={(e) => setJoin((v) => ({ ...v, email: e.target.value }))}
                  placeholder="you@example.com"
                />

                <label className="sponsor-label" htmlFor="joinPhone">Phone Number</label>
                <input
                  id="joinPhone"
                  type="tel"
                  value={join.phone}
                  onChange={(e) => setJoin((v) => ({ ...v, phone: e.target.value }))}
                  placeholder="(555) 555-5555"
                />
                <p className="interest-contact-hint">
                  Please provide a phone number or an email address so we can reach you.
                </p>

                <label className="sponsor-label" htmlFor="joinIntro">Brief self-introduction</label>
                <textarea
                  id="joinIntro"
                  value={join.intro}
                  onChange={(e) => setJoin((v) => ({ ...v, intro: e.target.value }))}
                  placeholder="Tell us a little about yourself and why you're interested."
                />

                <label className="sponsor-label" htmlFor="joinHeard">
                  How did you hear about the FTC team?
                </label>
                <input
                  id="joinHeard"
                  type="text"
                  value={join.heard_about}
                  onChange={(e) => setJoin((v) => ({ ...v, heard_about: e.target.value }))}
                  placeholder="A friend, school, social media..."
                />

                <p className="interest-disclaimer">
                  Before submitting this form, please note that FTC team participation typically
                  requires a commitment of 2&ndash;3 hours per week. Participants are expected to
                  actively engage in team activities and regularly support outreach efforts.
                </p>

                <label className="interest-checkbox">
                  <input
                    type="checkbox"
                    checked={join.acknowledged}
                    onChange={(e) => setJoin((v) => ({ ...v, acknowledged: e.target.checked }))}
                  />
                  <span>
                    I understand the expected time commitment and participation requirements.
                  </span>
                </label>

                <button
                  type="submit"
                  className="admin-save-btn sponsor-submit-btn"
                  disabled={submitting || !join.acknowledged}
                >
                  {submitting ? "Submitting\u2026" : "Submit interest form"}
                </button>
                {error && <p className="sponsor-form-error">{error}</p>}
                <button type="button" className="sponsor-link-btn" onClick={() => setChoice("")}>
                  &larr; Choose a different option
                </button>
              </form>
            </div>
          ) : (
            <div className="sponsor-form-card">
              <form className="sponsor-form" onSubmit={submitOnboard}>
                <div className="sponsor-form-title">Tell us about the new team</div>
                <p className="sponsor-form-sub">
                  Please share a few details about the team so we can better understand your current
                  status and the support you may need.
                </p>

                <label className="sponsor-label" htmlFor="obName">Your Name</label>
                <input
                  id="obName"
                  type="text"
                  required
                  value={onboard.full_name}
                  onChange={(e) => setOnboard((v) => ({ ...v, full_name: e.target.value }))}
                  placeholder="Your full name"
                />

                <label className="sponsor-label" htmlFor="obEmail">
                  Email Address <span className="sponsor-optional">(optional if phone provided)</span>
                </label>
                <input
                  id="obEmail"
                  type="email"
                  value={onboard.email}
                  onChange={(e) => setOnboard((v) => ({ ...v, email: e.target.value }))}
                  placeholder="you@example.com"
                />

                <label className="sponsor-label" htmlFor="obPhone">
                  Phone Number <span className="sponsor-optional">(optional if email provided)</span>
                </label>
                <input
                  id="obPhone"
                  type="tel"
                  value={onboard.phone}
                  onChange={(e) => setOnboard((v) => ({ ...v, phone: e.target.value }))}
                  placeholder="(555) 555-5555"
                />

                <label className="sponsor-label" htmlFor="obLocation">Team Location</label>
                <input
                  id="obLocation"
                  type="text"
                  required
                  value={onboard.team_location}
                  onChange={(e) => setOnboard((v) => ({ ...v, team_location: e.target.value }))}
                  placeholder="City, State"
                />

                <label className="sponsor-label" htmlFor="obStudents">
                  Number of students already identified
                </label>
                <input
                  id="obStudents"
                  type="text"
                  value={onboard.student_count}
                  onChange={(e) => setOnboard((v) => ({ ...v, student_count: e.target.value }))}
                  placeholder="e.g. 4"
                />

                <label className="sponsor-label" htmlFor="obMemberSupport">
                  Do you need support identifying additional team members?
                </label>
                <select
                  id="obMemberSupport"
                  value={onboard.needs_member_support}
                  onChange={(e) =>
                    setOnboard((v) => ({ ...v, needs_member_support: e.target.value }))
                  }
                >
                  <option value="">Select an option...</option>
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                  <option value="Maybe">Maybe / Not sure yet</option>
                </select>

                <label className="sponsor-label" htmlFor="obOnboarding">
                  Do you need help with onboarding or next steps?
                </label>
                <select
                  id="obOnboarding"
                  value={onboard.needs_onboarding_help}
                  onChange={(e) =>
                    setOnboard((v) => ({ ...v, needs_onboarding_help: e.target.value }))
                  }
                >
                  <option value="">Select an option...</option>
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                  <option value="Maybe">Maybe / Not sure yet</option>
                </select>

                <label className="sponsor-label" htmlFor="obInfo">
                  Additional information or questions
                </label>
                <textarea
                  id="obInfo"
                  value={onboard.additional_info}
                  onChange={(e) => setOnboard((v) => ({ ...v, additional_info: e.target.value }))}
                  placeholder="Anything else you'd like us to know."
                />

                <button
                  type="submit"
                  className="admin-save-btn sponsor-submit-btn"
                  disabled={submitting}
                >
                  {submitting ? "Submitting\u2026" : "Submit team onboarding request"}
                </button>
                {error && <p className="sponsor-form-error">{error}</p>}
                <button type="button" className="sponsor-link-btn" onClick={() => setChoice("")}>
                  &larr; Choose a different option
                </button>
              </form>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}

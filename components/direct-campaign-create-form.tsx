"use client";

import { useActionState } from "react";
import { createDirectCampaignAction, type DirectCreateState } from "@/app/admin/direct/actions";

const initialState: DirectCreateState = { status: "idle", message: "" };

export function DirectCampaignCreateForm() {
  const [state, action, pending] = useActionState(createDirectCampaignAction, initialState);

  return (
    <section className="admin-decision-card">
      <span className="app-eyebrow">Pulse Direct</span>
      <h2>Create a real launch campaign.</h2>
      <p>Pulse Direct is owned inventory: a campaign is created first, then funded and activated. The callback secret is shown only once here and is never placed in the URL.</p>

      {state.status === "error" ? <div className="auth-alert error">{state.message}</div> : null}
      {state.status === "created" ? (
        <div className="auth-alert success direct-secret-result">
          <strong>{state.message}</strong>
          <span>Campaign ID</span>
          <code>{state.campaignId}</code>
          <span>Callback secret · copy now</span>
          <code>{state.callbackSecret}</code>
        </div>
      ) : null}

      <form action={action} className="affiliate-offer-form">
        <div className="affiliate-form-grid">
          <label>Advertiser<input name="advertiser_name" required maxLength={160} placeholder="Pulsercuit launch partner" /></label>
          <label>Action type
            <select name="action_type" defaultValue="custom">
              <option value="custom">Custom</option>
              <option value="signup">Signup</option>
              <option value="survey">Survey</option>
              <option value="milestone">Milestone</option>
              <option value="install">Install</option>
              <option value="trial">Trial</option>
              <option value="purchase">Purchase</option>
            </select>
          </label>
          <label className="wide">Campaign title<input name="title" required maxLength={180} placeholder="Complete the launch action" /></label>
          <label className="wide">Description<textarea name="description" maxLength={1500} rows={3} placeholder="What must the member complete?" /></label>
          <label>Category<input name="category" maxLength={80} defaultValue="other" /></label>
          <label>Estimated minutes<input name="estimated_minutes" type="number" min={1} max={10080} defaultValue={5} /></label>
          <label>Price per verified action · USD<input name="price_per_action_usd" required inputMode="decimal" placeholder="0.02" /></label>
          <label>User reward · credits<input name="reward_credits" required type="number" min={1} max={1000000} defaultValue={10} /></label>
          <label>Maximum completions<input name="max_completions" required type="number" min={1} max={1000000} defaultValue={100} /></label>
          <label>Countries<input name="country_codes" maxLength={200} placeholder="BR,US" /></label>
          <label>Platforms<input name="device_platforms" maxLength={200} defaultValue="web,mobile,desktop" /></label>
          <label className="wide">Verified destination URL<input name="destination_url" type="url" required maxLength={2000} placeholder="https://partner.example/task" /></label>
        </div>
        <button className="button" type="submit" disabled={pending}>{pending ? "Creating…" : "Create campaign"}</button>
      </form>
    </section>
  );
}

const FIELD_BASE =
  "w-full rounded-md border bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500/60";

function Field({ label, name, type = "text", value, onChange, error, placeholder, autoComplete }) {
  return (
    <div>
      <label htmlFor={name} className="mb-1 block text-xs font-medium text-slate-300">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={(e) => onChange(name, e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className={`${FIELD_BASE} ${error ? "border-pink-500" : "border-slate-700"}`}
      />
      {error && <p className="mt-1 text-xs text-pink-400">{error}</p>}
    </div>
  );
}

export function CheckoutForm({ form, errors, onChange }) {
  return (
    <div className="space-y-8">
      {/* Contact information */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <h2 className="mb-4 text-base font-semibold text-white">Contact information</h2>
        <Field
          label="Email address"
          name="email"
          type="email"
          value={form.email}
          onChange={onChange}
          error={errors.email}
          placeholder="you@example.com"
          autoComplete="email"
        />
      </section>

      {/* Shipping information */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <h2 className="mb-4 text-base font-semibold text-white">Shipping information</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field
              label="Full name"
              name="name"
              value={form.name}
              onChange={onChange}
              error={errors.name}
              placeholder="Jane Doe"
              autoComplete="name"
            />
          </div>
          <div className="sm:col-span-2">
            <Field
              label="Address"
              name="address"
              value={form.address}
              onChange={onChange}
              error={errors.address}
              placeholder="123 Main St"
              autoComplete="street-address"
            />
          </div>
          <Field
            label="City"
            name="city"
            value={form.city}
            onChange={onChange}
            error={errors.city}
            placeholder="Brooklyn"
            autoComplete="address-level2"
          />
          <Field
            label="State / Province"
            name="state"
            value={form.state}
            onChange={onChange}
            error={errors.state}
            placeholder="NY"
            autoComplete="address-level1"
          />
          <Field
            label="Postal code"
            name="postalCode"
            value={form.postalCode}
            onChange={onChange}
            error={errors.postalCode}
            placeholder="11201"
            autoComplete="postal-code"
          />
          <Field
            label="Country"
            name="country"
            value={form.country}
            onChange={onChange}
            error={errors.country}
            placeholder="United States"
            autoComplete="country-name"
          />
        </div>
      </section>
    </div>
  );
}

import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiErrorMessage } from "../../api/client";
import { Currency, UnitOfMeasure, UomConversion } from "../../api/types";

export function UnitsAndCurrencies() {
  const [tab, setTab] = useState<"uom" | "currencies">("uom");
  return (
    <div>
      <div className="page-header">
        <h1>Unités & devises</h1>
      </div>
      <div className="tabs">
        <button className={tab === "uom" ? "active" : ""} onClick={() => setTab("uom")}>
          Unités de mesure
        </button>
        <button className={tab === "currencies" ? "active" : ""} onClick={() => setTab("currencies")}>
          Devises & taux de change
        </button>
      </div>
      {tab === "uom" ? <UomTab /> : <CurrenciesTab />}
    </div>
  );
}

function UomTab() {
  const qc = useQueryClient();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fromUomId, setFromUomId] = useState("");
  const [toUomId, setToUomId] = useState("");
  const [factor, setFactor] = useState(1);

  const { data: uoms = [] } = useQuery<UnitOfMeasure[]>({
    queryKey: ["uoms"],
    queryFn: async () => (await api.get("/referentiels/uom")).data,
  });
  const { data: conversions = [] } = useQuery<UomConversion[]>({
    queryKey: ["uom-conversions"],
    queryFn: async () => (await api.get("/referentiels/uom/conversions")).data,
  });

  const createUom = useMutation({
    mutationFn: async () => api.post("/referentiels/uom", { code, name }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["uoms"] });
      setCode("");
      setName("");
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const createConversion = useMutation({
    mutationFn: async () => api.post("/referentiels/uom/conversions", { fromUomId, toUomId, factor }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["uom-conversions"] }),
    onError: (err) => setError(apiErrorMessage(err)),
  });

  return (
    <div className="form-grid">
      <div className="card">
        <h3>Unités de mesure</h3>
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Nom</th>
            </tr>
          </thead>
          <tbody>
            {uoms.map((u) => (
              <tr key={u.id}>
                <td>{u.code}</td>
                <td>{u.name}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <form
          className="flex-row mt-16"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            setError(null);
            createUom.mutate();
          }}
        >
          <input placeholder="Code (KG...)" value={code} onChange={(e) => setCode(e.target.value)} required />
          <input placeholder="Nom" value={name} onChange={(e) => setName(e.target.value)} required />
          <button className="btn btn-sm">Ajouter</button>
        </form>
        {error && <p className="error-text">{error}</p>}
      </div>

      <div className="card">
        <h3>Conversions (1 unité source = facteur × unité cible)</h3>
        <table>
          <thead>
            <tr>
              <th>Source</th>
              <th>Cible</th>
              <th className="text-right">Facteur</th>
            </tr>
          </thead>
          <tbody>
            {conversions.map((c) => (
              <tr key={c.id}>
                <td>{c.fromUom.code}</td>
                <td>{c.toUom.code}</td>
                <td className="text-right">{c.factor}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <form
          className="flex-row mt-16"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            setError(null);
            createConversion.mutate();
          }}
        >
          <select value={fromUomId} onChange={(e) => setFromUomId(e.target.value)} required>
            <option value="">Source</option>
            {uoms.map((u) => (
              <option key={u.id} value={u.id}>
                {u.code}
              </option>
            ))}
          </select>
          <select value={toUomId} onChange={(e) => setToUomId(e.target.value)} required>
            <option value="">Cible</option>
            {uoms.map((u) => (
              <option key={u.id} value={u.id}>
                {u.code}
              </option>
            ))}
          </select>
          <input
            type="number"
            step="0.001"
            style={{ width: 90 }}
            value={factor}
            onChange={(e) => setFactor(Number(e.target.value))}
          />
          <button className="btn btn-sm">Ajouter</button>
        </form>
      </div>
    </div>
  );
}

function CurrenciesTab() {
  const qc = useQueryClient();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [rateInputs, setRateInputs] = useState<Record<string, string>>({});

  const { data: currencies = [] } = useQuery<Currency[]>({
    queryKey: ["currencies"],
    queryFn: async () => (await api.get("/referentiels/currencies")).data,
  });

  const createCurrency = useMutation({
    mutationFn: async () => api.post("/referentiels/currencies", { code: code.toUpperCase(), name, symbol }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["currencies"] });
      setCode("");
      setName("");
      setSymbol("");
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const addRate = useMutation({
    mutationFn: async (currencyCode: string) =>
      api.post(`/referentiels/currencies/${currencyCode}/rates`, { rateToBase: Number(rateInputs[currencyCode]) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["currencies"] }),
    onError: (err) => setError(apiErrorMessage(err)),
  });

  return (
    <div className="card">
      <h3>Devises</h3>
      <table>
        <thead>
          <tr>
            <th>Code</th>
            <th>Nom</th>
            <th>Symbole</th>
            <th>Dernier taux vers devise de base</th>
            <th>Nouveau taux</th>
          </tr>
        </thead>
        <tbody>
          {currencies.map((c) => (
            <tr key={c.code}>
              <td>{c.code}</td>
              <td>{c.name}</td>
              <td>{c.symbol}</td>
              <td>{c.isBaseCurrency ? "Devise de base" : c.exchangeRates?.[0]?.rateToBase ?? "-"}</td>
              <td>
                {!c.isBaseCurrency && (
                  <div className="flex-row">
                    <input
                      type="number"
                      step="0.0001"
                      style={{ width: 100 }}
                      value={rateInputs[c.code] ?? ""}
                      onChange={(e) => setRateInputs({ ...rateInputs, [c.code]: e.target.value })}
                    />
                    <button className="btn btn-sm" onClick={() => addRate.mutate(c.code)}>
                      Mettre à jour
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <form
        className="flex-row mt-16"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          setError(null);
          createCurrency.mutate();
        }}
      >
        <input placeholder="Code (USD...)" value={code} onChange={(e) => setCode(e.target.value)} required maxLength={3} />
        <input placeholder="Nom" value={name} onChange={(e) => setName(e.target.value)} required />
        <input placeholder="Symbole" value={symbol} onChange={(e) => setSymbol(e.target.value)} required style={{ width: 70 }} />
        <button className="btn btn-sm">Ajouter</button>
      </form>
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}

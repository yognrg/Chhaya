"use client";

import { useState } from "react";
import { DEFAULT_FRAME, type Edit, type FrameKind, type FrameSettings } from "../edit";
import { FRAMES } from "../frames";
import { Chips } from "./Chips";
import { HairlineSlider } from "./HairlineSlider";

type Props = {
  edit: Edit;
  onLive: (e: Edit) => void;
  onCommit: (e: Edit) => void;
};

type Sub = "caption" | "date" | "paper" | "border";

const HAS_CAPTION: FrameKind[] = ["instant", "sx70", "mini", "wide", "strip"];

export function PrintPanel({ edit, onLive, onCommit }: Props) {
  const f = edit.frame;
  const [sub, setSub] = useState<Sub>("caption");
  const set = (p: Partial<FrameSettings>) => ({ ...edit, frame: { ...f, ...p } });
  const frame = FRAMES.find((x) => x.kind === f.kind)!;

  const subs: { id: Sub; label: string; edited: boolean }[] = [
    ...(HAS_CAPTION.includes(f.kind) ? [{ id: "caption" as Sub, label: "Caption", edited: !!f.caption }] : []),
    { id: "date", label: "Date stamp", edited: f.date },
    ...(f.kind !== "film" ? [{ id: "paper" as Sub, label: "Paper", edited: f.paper !== DEFAULT_FRAME.paper }] : []),
    ...(f.kind === "border" || f.kind === "strip" ? [{ id: "border" as Sub, label: "Border", edited: f.borderColor !== "white" }] : []),
  ];
  const active = subs.find((s) => s.id === sub) ?? subs[0];

  return (
    <>
      <div className="ch-panel-control">
        {f.kind === "none" ? (
          <div className="ch-control">
            <div className="ch-control-head">
              <span className="ch-control-name">Print</span>
              <span className="ch-label ch-faint">pick a frame</span>
            </div>
            <Chips
              label="Date stamp"
              value={f.date ? "on" : "off"}
              options={[{ value: "off", label: "No date" }, { value: "on", label: "’26 date stamp" }]}
              onChange={(v) => onCommit(set({ date: v === "on" }))}
            />
          </div>
        ) : (
          <div className="ch-control" key={f.kind}>
            <div className="ch-control-head">
              <span className="ch-control-name">{frame.label === "600" ? "Instant 600" : frame.label}</span>
              <span className="ch-label ch-faint">{frame.hint}</span>
            </div>
            <div className="ch-subtabs" role="tablist" aria-label="Print settings">
              {subs.map((s) => (
                <button
                  key={s.id}
                  role="tab"
                  aria-selected={active.id === s.id}
                  className={`ch-subtab${active.id === s.id ? " is-on" : ""}`}
                  onClick={() => setSub(s.id)}
                >
                  {s.label}
                  {s.edited && <span className="ch-dot" aria-hidden="true" />}
                </button>
              ))}
            </div>
            {active.id === "caption" && (
              <input
                className="ch-text-input ch-caption-input"
                aria-label="Caption"
                placeholder="write a caption…"
                maxLength={40}
                value={f.caption}
                onChange={(e) => onLive(set({ caption: e.target.value }))}
                onBlur={(e) => onCommit(set({ caption: e.target.value }))}
              />
            )}
            {active.id === "date" && (
              <Chips
                label="Date stamp"
                value={f.date ? "on" : "off"}
                options={[{ value: "off", label: "Off" }, { value: "on", label: "’26 10 30" }]}
                onChange={(v) => onCommit(set({ date: v === "on" }))}
              />
            )}
            {active.id === "paper" && (
              <HairlineSlider
                label="Paper texture"
                value={f.paper}
                min={0}
                max={100}
                step={1}
                defaultValue={DEFAULT_FRAME.paper}
                decimals={0}
                signed={false}
                onChange={(v) => onLive(set({ paper: v }))}
              />
            )}
            {active.id === "border" && (
              <>
                <Chips
                  label="Border colour"
                  value={f.borderColor}
                  options={[
                    { value: "white", label: "White", swatch: "#fbfaf7" },
                    { value: "black", label: "Black", swatch: "#0f0f0e" },
                  ]}
                  onChange={(v) => onCommit(set({ borderColor: v }))}
                />
                {f.kind === "border" && (
                  <HairlineSlider
                    label="Border thickness"
                    value={f.borderSize}
                    min={0}
                    max={20}
                    step={0.5}
                    defaultValue={DEFAULT_FRAME.borderSize}
                    decimals={1}
                    signed={false}
                    onChange={(v) => onLive(set({ borderSize: v }))}
                  />
                )}
              </>
            )}
          </div>
        )}
      </div>

      <div className="ch-looks ch-frames" role="listbox" aria-label="Frames">
        {FRAMES.map((x) => {
          const on = x.kind === f.kind;
          return (
            <button
              key={x.kind}
              role="option"
              aria-selected={on}
              aria-label={`${x.label}, ${x.hint}`}
              className={`ch-look${on ? " is-on" : ""}`}
              onClick={() => onCommit(set({ kind: x.kind }))}
            >
              <span className={`ch-look-thumb ch-frame-tile is-${x.kind}`}>
                <span className="ch-frame-tile-photo" />
              </span>
              <span className="ch-look-code">{x.label}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}

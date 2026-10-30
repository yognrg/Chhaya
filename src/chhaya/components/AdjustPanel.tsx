"use client";

import { Fragment, useState } from "react";
import {
  type Edit,
  HSL_COLOURS,
  HSL_SWATCH,
  hslSlider,
  isParamEdited,
  isToolEdited,
  type Param,
  TOOLS,
} from "../edit";
import { Chips } from "./Chips";
import { HairlineSlider } from "./HairlineSlider";
import { Icon, type IconName } from "./Icon";

type Props = {
  edit: Edit;
  onLive: (e: Edit) => void;
  onCommit: (e: Edit) => void;
};

const HSL_CHANNELS = ["Hue", "Saturation", "Luminance"];

export function AdjustPanel({ edit, onLive, onCommit }: Props) {
  const [toolId, setToolId] = useState<string | null>(null);
  const [paramIdx, setParamIdx] = useState(0);
  const [hslColour, setHslColour] = useState(0);
  const tool = TOOLS.find((t) => t.id === toolId);

  const params: Param[] = tool?.hsl
    ? HSL_CHANNELS.map((label, ch) => hslSlider(hslColour, ch, label))
    : (tool?.params ?? []);
  const param = params[Math.min(paramIdx, params.length - 1)];

  const pickTool = (id: string) => {
    setToolId((k) => (k === id ? null : id));
    setParamIdx(0);
  };

  return (
    <>
      <div className="ch-panel-control">
        {!tool && (
          <div className="ch-control ch-control-quiet">
            <span className="ch-label ch-faint">pick a tool · double-tap a slider to reset</span>
          </div>
        )}
        {tool && (
          <div className="ch-control" key={tool.id}>
            <div className="ch-control-head">
              <span className="ch-label">{tool.label}</span>
              {tool.crop && (
                <span className="ch-head-actions">
                  <button
                    className="ch-icon-btn ch-icon-sm"
                    aria-label="Rotate 90°"
                    onClick={() =>
                      onCommit({ ...edit, geometry: { ...edit.geometry, rotate: ((edit.geometry.rotate + 1) % 4) as 0 | 1 | 2 | 3 } })
                    }
                  >
                    <Icon name="rotate" size={18} />
                  </button>
                  <button
                    className={`ch-icon-btn ch-icon-sm${edit.geometry.flip ? " is-on" : ""}`}
                    aria-label="Flip horizontally"
                    aria-pressed={edit.geometry.flip}
                    onClick={() => onCommit({ ...edit, geometry: { ...edit.geometry, flip: !edit.geometry.flip } })}
                  >
                    <Icon name="flipH" size={18} />
                  </button>
                </span>
              )}
            </div>

            {tool.hsl && (
              <div className="ch-swatches" role="radiogroup" aria-label="Colour">
                {HSL_COLOURS.map((c, i) => {
                  const edited = [0, 1, 2].some((ch) => edit.hsl[i * 3 + ch] !== 0);
                  return (
                    <button
                      key={c}
                      role="radio"
                      aria-checked={hslColour === i}
                      aria-label={`${c}${edited ? ", edited" : ""}`}
                      className={`ch-swatch${hslColour === i ? " is-on" : ""}`}
                      style={{ background: HSL_SWATCH[i] }}
                      onClick={() => setHslColour(i)}
                    >
                      {edited && <span className="ch-dot" aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>
            )}

            {params.length > 1 && (
              <div className="ch-subtabs" role="tablist" aria-label={`${tool.label} settings`}>
                {params.map((p, i) => (
                  <button
                    key={p.label}
                    role="tab"
                    aria-selected={param === p}
                    className={`ch-subtab${param === p ? " is-on" : ""}`}
                    onClick={() => setParamIdx(i)}
                  >
                    {p.label}
                    {p.kind === "slider" && isParamEdited(edit, p) && <span className="ch-dot" aria-hidden="true" />}
                  </button>
                ))}
              </div>
            )}

            {param?.kind === "slider" && (
              <HairlineSlider
                key={`${tool.id}-${param.label}-${hslColour}`}
                label={param.label}
                value={param.get(edit)}
                min={param.min}
                max={param.max}
                step={param.step}
                defaultValue={param.def}
                decimals={param.decimals}
                signed={param.min < 0}
                hue={param.hue}
                onChange={(v) => onLive(param.set(edit, v))}
              />
            )}
            {param?.kind === "choice" && (
              <Chips
                label={param.label}
                options={param.options}
                value={param.get(edit)}
                onChange={(v) => onCommit(param.set(edit, v))}
              />
            )}
          </div>
        )}
      </div>

      <div className="ch-tools" role="toolbar" aria-label="Adjustments">
        {TOOLS.map((t, i) => {
          const edited = isToolEdited(edit, t);
          return (
            <Fragment key={t.id}>
              {i > 0 && TOOLS[i - 1].group !== t.group && <span className="ch-tools-divider" aria-hidden="true" />}
              <button
                className={`ch-tool${toolId === t.id ? " is-on" : ""}`}
                onClick={() => pickTool(t.id)}
                aria-pressed={toolId === t.id}
                aria-label={`${t.label}${edited ? ", edited" : ""}`}
              >
                <Icon name={t.id as IconName} />
                <span className="ch-tool-label">{t.short}</span>
                {edited && <span className="ch-dot" aria-hidden="true" />}
              </button>
            </Fragment>
          );
        })}
      </div>
    </>
  );
}

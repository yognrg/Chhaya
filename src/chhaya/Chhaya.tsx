"use client";

import { useCallback, useEffect, useState } from "react";
import { type Photo, photoFromFile } from "./camera";
import { Camera, type CameraMode } from "./components/Camera";
import { Develop, type Tab } from "./components/Develop";
import { DEFAULT_EDIT, type Edit, mergeEdit } from "./edit";
import { Intro } from "./components/Intro";
import { NO_LOOK } from "./looks";

type Screen = "intro" | "camera" | "develop";

/** Shoot → develop. Print and Studio arrive in later phases. */
export function Chhaya() {
  const [screen, setScreen] = useState<Screen>("intro");
  const [from, setFrom] = useState<"intro" | "camera">("intro");
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [shot, setShot] = useState(0);
  const [look, setLook] = useState(NO_LOOK);
  const [mode, setMode] = useState<CameraMode>("photo");
  const [start, setStart] = useState<{ edit: Edit; tab: Tab }>({ edit: DEFAULT_EDIT, tab: "looks" });
  const [error, setError] = useState<string | null>(null);

  const open = useCallback((p: Photo, origin: "intro" | "camera", shotMode: CameraMode = "photo") => {
    // The camera's look carries over; ASCII and strip shots open ready to go.
    setStart({
      edit: mergeEdit(DEFAULT_EDIT, {
        look: origin === "camera" ? look : NO_LOOK,
        ascii: { enabled: shotMode === "ascii" },
        frame: { kind: p.strip > 1 ? "strip" : "none" },
      }),
      tab: shotMode === "ascii" ? "ascii" : p.strip > 1 ? "print" : "looks",
    });
    setPhoto((old) => {
      old?.bitmap.close();
      return p;
    });
    setShot((n) => n + 1);
    setFrom(origin);
    setScreen("develop");
  }, [look]);

  const upload = useCallback(
    (file: File, origin: "intro" | "camera") => {
      setError(null);
      photoFromFile(file)
        .then((p) => open(p, origin))
        .catch(() => setError("couldn't open that file. try a JPG, PNG or HEIC exported as JPG."));
    },
    [open],
  );

  // Drop a photo anywhere to edit it.
  useEffect(() => {
    const over = (e: DragEvent) => e.preventDefault();
    const drop = (e: DragEvent) => {
      e.preventDefault();
      const f = [...(e.dataTransfer?.files ?? [])].find((x) => x.type.startsWith("image/"));
      if (f) upload(f, screen === "camera" ? "camera" : "intro");
    };
    window.addEventListener("dragover", over);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragover", over);
      window.removeEventListener("drop", drop);
    };
  }, [upload, screen]);

  return (
    <main className="ch-app">
      {screen === "intro" && <Intro onStart={() => setScreen("camera")} onUpload={(f) => upload(f, "intro")} />}
      {screen === "camera" && (
        <Camera
          look={look}
          mode={mode}
          onModeChange={setMode}
          onLookChange={setLook}
          onCapture={(p, m) => open(p, "camera", m)}
          onUpload={(f) => upload(f, "camera")}
          onClose={() => setScreen("intro")}
        />
      )}
      {screen === "develop" && photo && (
        <Develop key={shot} photo={photo} initialEdit={start.edit} initialTab={start.tab} onBack={() => setScreen(from)} />
      )}
      {error && (
        <p className="ch-toast" role="alert" onClick={() => setError(null)}>
          {error}
        </p>
      )}
    </main>
  );
}

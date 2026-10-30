"use client";

import { useCallback, useEffect, useState } from "react";
import { type Photo, photoFromFile } from "./camera";
import { Camera } from "./components/Camera";
import { Develop } from "./components/Develop";
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
  const [error, setError] = useState<string | null>(null);

  const open = useCallback((p: Photo, origin: "intro" | "camera") => {
    setPhoto((old) => {
      old?.bitmap.close();
      return p;
    });
    setShot((n) => n + 1);
    setFrom(origin);
    setScreen("develop");
  }, []);

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
          onLookChange={setLook}
          onCapture={(p) => open(p, "camera")}
          onUpload={(f) => upload(f, "camera")}
          onClose={() => setScreen("intro")}
        />
      )}
      {screen === "develop" && photo && (
        <Develop key={shot} photo={photo} initialLook={look} onBack={() => setScreen(from)} />
      )}
      {error && (
        <p className="ch-toast" role="alert" onClick={() => setError(null)}>
          {error}
        </p>
      )}
    </main>
  );
}

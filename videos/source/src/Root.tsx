import React from "react";
import { Composition } from "remotion";
import { Main, SingleScene } from "./Main";
import { EPISODES, TIMELINE, type EpisodeId } from "./lib/timing";
import { KitPreview } from "./preview/KitPreview";
import { CastPreview } from "./preview/CastPreview";
import { FlightPreview } from "./preview/FlightPreview";
import { XrayPreview } from "./preview/XrayPreview";
import { PlatePreview } from "./preview/PlatePreview";
import { Ep2KitPreview } from "./preview/Ep2KitPreview";
import { ThumbA } from "./preview/thumb/ThumbA";
import { ThumbB } from "./preview/thumb/ThumbB";
import { ThumbC } from "./preview/thumb/ThumbC";
import { AvatarA } from "./preview/avatar/AvatarA";
import { AvatarQuick } from "./preview/avatar/AvatarQuick";
import { AvatarB } from "./preview/avatar/AvatarB";
import { AvatarC } from "./preview/avatar/AvatarC";
import { Set1A } from "./preview/thumb/sets/Set1A";
import { Set1B } from "./preview/thumb/sets/Set1B";
import { Set1C } from "./preview/thumb/sets/Set1C";
import { Set2A } from "./preview/thumb/sets/Set2A";
import { Set2B } from "./preview/thumb/sets/Set2B";
import { Set2C } from "./preview/thumb/sets/Set2C";
import { Set3A } from "./preview/thumb/sets/Set3A";
import { Set3B } from "./preview/thumb/sets/Set3B";
import { Set3C } from "./preview/thumb/sets/Set3C";
import { Set4A } from "./preview/thumb/sets/Set4A";
import { Set4B } from "./preview/thumb/sets/Set4B";
import { Set4C } from "./preview/thumb/sets/Set4C";
import { Set5A } from "./preview/thumb/sets/Set5A";
import { Set5B } from "./preview/thumb/sets/Set5B";
import { Set5C } from "./preview/thumb/sets/Set5C";
import { Ep2SharedPreview } from "./preview/Ep2SharedPreview";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {(Object.keys(EPISODES) as EpisodeId[]).map((ep) => (
        <Composition
          key={ep}
          id={`Kicks-${ep}`}
          component={Main}
          defaultProps={{ episode: ep }}
          durationInFrames={Math.max(1, EPISODES[ep].totalFrames)}
          fps={30}
          width={1920}
          height={1080}
        />
      ))}
      {TIMELINE.scenes.map((s) => (
        <Composition
          key={s.id}
          id={`S-${s.id}`}
          component={SingleScene}
          defaultProps={{ id: s.id }}
          durationInFrames={s.frames}
          fps={30}
          width={1920}
          height={1080}
        />
      ))}
      <Composition id="CastPreview" component={CastPreview} durationInFrames={1} fps={30} width={1920} height={1080} />
      <Composition id="FlightPreview" component={FlightPreview} durationInFrames={60} fps={30} width={1920} height={1080} />
      <Composition id="XrayPreview" component={XrayPreview} durationInFrames={120} fps={30} width={1920} height={1080} />
      <Composition id="PlatePreview" component={PlatePreview} durationInFrames={120} fps={30} width={1920} height={1080} />
      <Composition id="KitPreview" component={KitPreview} durationInFrames={90} fps={30} width={1920} height={1080} />
      <Composition id="ThumbA" component={ThumbA} durationInFrames={1} fps={30} width={1280} height={720} />
      <Composition id="ThumbB" component={ThumbB} durationInFrames={1} fps={30} width={1280} height={720} />
      <Composition id="Set1A" component={Set1A} durationInFrames={1} fps={30} width={1280} height={720} />
      <Composition id="Set1B" component={Set1B} durationInFrames={1} fps={30} width={1280} height={720} />
      <Composition id="Set1C" component={Set1C} durationInFrames={1} fps={30} width={1280} height={720} />
      <Composition id="Set2A" component={Set2A} durationInFrames={1} fps={30} width={1280} height={720} />
      <Composition id="Set2B" component={Set2B} durationInFrames={1} fps={30} width={1280} height={720} />
      <Composition id="Set2C" component={Set2C} durationInFrames={1} fps={30} width={1280} height={720} />
      <Composition id="Set3A" component={Set3A} durationInFrames={1} fps={30} width={1280} height={720} />
      <Composition id="Set3B" component={Set3B} durationInFrames={1} fps={30} width={1280} height={720} />
      <Composition id="Set3C" component={Set3C} durationInFrames={1} fps={30} width={1280} height={720} />
      <Composition id="Set4A" component={Set4A} durationInFrames={1} fps={30} width={1280} height={720} />
      <Composition id="Set4B" component={Set4B} durationInFrames={1} fps={30} width={1280} height={720} />
      <Composition id="Set4C" component={Set4C} durationInFrames={1} fps={30} width={1280} height={720} />
      <Composition id="Set5A" component={Set5A} durationInFrames={1} fps={30} width={1280} height={720} />
      <Composition id="Set5B" component={Set5B} durationInFrames={1} fps={30} width={1280} height={720} />
      <Composition id="Set5C" component={Set5C} durationInFrames={1} fps={30} width={1280} height={720} />
      <Composition id="AvatarQuick" component={AvatarQuick} durationInFrames={1} fps={30} width={800} height={800} />
      <Composition id="AvatarA" component={AvatarA} durationInFrames={1} fps={30} width={800} height={800} />
      <Composition id="AvatarB" component={AvatarB} durationInFrames={1} fps={30} width={800} height={800} />
      <Composition id="AvatarC" component={AvatarC} durationInFrames={1} fps={30} width={800} height={800} />
      <Composition id="ThumbC" component={ThumbC} durationInFrames={1} fps={30} width={1280} height={720} />
      <Composition id="Ep2KitPreview" component={Ep2KitPreview} durationInFrames={120} fps={30} width={1920} height={1080} />
      <Composition id="Ep2SharedPreview" component={Ep2SharedPreview} durationInFrames={90} fps={30} width={1920} height={1080} />
    </>
  );
};

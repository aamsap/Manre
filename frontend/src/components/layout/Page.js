import React from "react";

export const Page = ({ children, testId, width = "md:max-w-2xl", pad = "px-5 pb-12 pt-8" }) => (
  <div className="min-h-screen w-full bg-[#EDE7E0]">
    <div
      data-testid={testId}
      className={`relative mx-auto min-h-screen w-full max-w-md bg-sand shadow-2xl md:min-h-0 md:my-10 md:rounded-[2rem] ${width} ${pad}`}
    >
      {children}
    </div>
  </div>
);

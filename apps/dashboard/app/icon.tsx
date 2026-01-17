import { ImageResponse } from "next/og";

export const size = {
  width: 32,
  height: 32,
};
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        fontSize: 18,
        background: "#fafafa",
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#ff3402",
        fontWeight: 700,
        borderRadius: 6,
      }}
    >
      //
    </div>,
    {
      ...size,
    },
  );
}

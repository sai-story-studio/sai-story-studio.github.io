import { redirect } from "next/navigation";

// The editable design lives in ordinary HTML/CSS/JavaScript.
export default function Home() {
  redirect("/experience/index.html");
}

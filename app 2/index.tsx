import { Redirect } from "expo-router";
import { useRecords } from "@/store/records";

export default function Index() {
  const { onboarded } = useRecords();
  return <Redirect href={onboarded ? "/(tabs)" : "/welcome"} />;
}

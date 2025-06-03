import { ProfileHeader } from '@/components/Profile/ProfileHeader';
import { ProfileTabs } from '@/components/Profile/ProfileTabs';

export const metadata = {
  title: "FC Swag Frame - Profile",
  description: "View your designs, orders, and earnings.",
};

export default function ProfilePage() {
  return (
    <main className="profile-page">
      <ProfileHeader />
      <ProfileTabs />
    </main>
  );
}
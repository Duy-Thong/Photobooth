/**
 * Script to manually initialize a Super Admin in Firestore.
 * Copy this code and run it in your browser console on the Admin page
 * after substituting your UID and Email.
 */

/*
import { db } from './src/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';

async function bootstrapAdmin(uid, email) {
  await setDoc(doc(db, "admins", uid), {
    email: email,
    role: "superadmin",
    permissions: {
      canViewPhotos: true,
      canViewVideos: true,
      canManageFrames: true,
      canManageRequests: true,
      canManageFeedback: true,
      canManageAdmins: true,
      photoDateRange: null,
      videoDateRange: null,
    },
    createdAt: new Date().toISOString()
  });
  console.log("✅ Admin " + email + " initialized!");
}

// bootstrapAdmin("YOUR_UID_HERE", "YOUR_EMAIL_HERE");
*/

export const manualInitInstructions = "Copy the commented code above into your browser console to manually set an admin.";

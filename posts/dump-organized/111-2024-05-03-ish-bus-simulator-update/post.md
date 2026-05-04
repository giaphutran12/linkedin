Bus Simulator Update

My partner Brian So, and I have been working tirelessly in the past 11 weeks to create this bus simulator

Cannon.js is used for collision handling, the bus is created using CANNON.RigidVehicle(), I put collision boxes all around the map using CANNON.Box. I would say this is the most painful step because the map is so broad, and coordinates collected on the screen have a different scale factor than the coordinate in the code. With some coordinate rescaling, I was able to get those collision boxes right.

The iconic song "Woke up this morning" you heard from the Sopranos is brought to you by Howler.js, a library that allows you to play sounds pretty nicely in Three.js. Also, if you hit the wall/lane divider then it will play a crashing sound.
If you do it too many times, the passengers will complain with the "oh, oh" sound.

If you accidentally flip the bus, press C to reset it to the initial position, you can see it at 0:33 of the video.

If you press F, it will mute/unmute the sound.

The brushes you see elevated in the air are me messing around with the map in Blender and making the brushes component elevated in the Y axis (lol)

Time elapsed was implemented by some extra HTML and CSS, using Date.now() as core function for it.

As you can see, there is still "Enter VR" that I have yet to post. I promise it will be even cooler. Stay tuned

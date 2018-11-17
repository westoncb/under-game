class Events {
	static enqueue(name, data) {
		Events.queue.push({name, data});
	}

	static addTimedEvent(name, data, duration) {
		Events.timedEvents[name] = {name, data, duration, startTime: Events.lastTime, completion: 0};	
		Events.enqueue(name + "_started", data);
	}

	static dequeue() {
		return Events.queue.shift();
	}

	static empty() {
		return Events.queue.length === 0;
	}

	static eventCompletion(name) {
		const event = Events.timedEvents[name];

		if (event) {
			return event.completion;
		} else {
			return -1;
		}
	}

	static isEventRunning(name) {
		return Events.eventCompletion(name) > -1;
	}

	static update(time) {
		const timedEvents = Events.timedEvents;

		Object.keys(timedEvents).forEach(eventName => {
			const event = timedEvents[eventName];
			const timeSoFar = time - event.startTime;
			event.completion = timeSoFar / event.duration;

			if (event.completion >= 1) {
				delete timedEvents[eventName]
				Events.enqueue(event.name + "_finished", event.data);
			}
		});

		lastTime = time;
	}
}
Events.queue = []
Events.timedEvents = {};
Events.lastTime = 0;

module.exports = Events;
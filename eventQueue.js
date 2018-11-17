class EventQueue {
	static enqueue(name, data) {
		EventQueue.queue.push({name, data});
	}

	static addTimedEvent(name, data, duration) {
		EventQueue.timedEvents[name] = {name, data, duration, startTime: EventQueue.lastTime, completion: 0};	
		EventQueue.enqueue(name + "_started", data);
	}

	static dequeue() {
		return EventQueue.queue.shift();
	}

	static empty() {
		return EventQueue.queue.length === 0;
	}

	static timedEventCompletion(name) {
		const event = EventQueue.timedEvents[name];

		if (event) {
			return event.completion;
		} else {
			return -1;
		}
	}

	static update(time) {
		const timedEvents = EventQueue.timedEvents;

		Object.keys(timedEvents).forEach(eventName => {
			const event = timedEvents[eventName];
			const timeSoFar = time - event.startTime;
			event.completion = timeSoFar / event.duration;

			if (event.completion >= 1) {
				delete timedEvents[eventName]
				EventQueue.enqueue(event.name + "_finished", event.data);
			}
		});

		lastTime = time;
	}
}
EventQueue.queue = []
EventQueue.timedEvents = {};
EventQueue.lastTime = 0;

module.exports = EventQueue;
class EventQueue {
	static push(event) {
		EventQueue.queue.push(event);
	}

	static pop() {
		return EventQueue.queue.shift();
	}

	static empty() {
		return EventQueue.queue.length === 0;
	}
}
EventQueue.queue = []

module.exports = EventQueue;
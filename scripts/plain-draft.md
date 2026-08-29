Every team I have worked on keeps a document that nobody reads. It has a name like Ways of Working. It was written in a week when someone had time, and it describes a version of the team that stopped existing about four months later. The document is not wrong, exactly. It is just no longer about anyone who works here, and everybody can tell, and nobody says so, because saying so would mean owning the thing.

The reason is not laziness. Writing the document is cheap. Keeping it true costs something every single week, and nobody budgets for that, because the cost arrives in pieces too small to look like work. A paragraph goes stale. A name changes. A tool gets swapped for another tool with the same job and a worse name. None of those are worth a meeting on their own, so none of them happen, and after two quarters the whole file is fiction with a good table of contents.

I used to think the fix was better tooling.

It is not better tooling.

The fix is a smaller document.

A document that describes twelve things will be wrong about nine of them by spring. A document that describes two things has a chance. The two things should be the ones a new person cannot learn by reading the code, because everything else is already written down somewhere that cannot drift: the repository, the dashboard, the on-call rota, the tickets. Prose is the worst place to store a fact that changes. Prose is the best place to store a reason, and reasons are the part nobody writes down, and reasons are the part that survives a reorganisation.

So the test I use now is simple. If a sentence in the team document would still be true after we replaced our entire toolchain, it stays. If it would need an edit, it belongs somewhere a machine can keep honest. That rule has cut our onboarding page from nine screens to one and a half, and the half is a list of links.

The objection is obvious and I have heard it four times. A short document leaves things out. Yes. It leaves out everything that a person can find in ten seconds by asking anyone, which is most of what the long document contained, and which is exactly what the long document got wrong first. The long version was never a map. It was a monument, and monuments are for people who have already left.

There is a second effect that surprised me. When the document is short, people edit it. Nobody wants to be the person who opens a nine screen file and changes one line in the middle of it, because the change looks like nothing and the file looks like somebody else's. A page and a half feels editable. Ownership tracks length more than it tracks permissions, and I have never seen that written in any handbook about documentation.

I am not claiming that this scales to a regulated industry with auditors and a compliance officer who needs the nine screens. It probably does not. What I am claiming is narrower. For a team of six to fifteen people who ship software and keep forgetting why they made the decisions they made, the document you should write is the one you would be embarrassed to leave stale, and the only way to be embarrassed is to be able to read the whole thing in one sitting.

Write the short one. Delete the long one. Nobody will ask for it back.
